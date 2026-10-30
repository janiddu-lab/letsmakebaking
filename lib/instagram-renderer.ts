import { chromium } from "playwright-core";
import { instagramUrl, parseInstagram, publicHtml } from "./public-social";
import type { SocialPost } from "./social-trends";

// 앱 기능으로 실행하는 독립 브라우저입니다. 사용자의 기존 브라우저 프로필·쿠키를 읽지 않습니다.
export async function renderInstagram(query: string, suppliedUrls: string[] = []) {
  let browser;
  if (process.platform === "linux") {
    try { browser = await chromium.launch({ headless: true, timeout: 7000 }); }
    catch { throw new Error("서버용 Chromium을 실행하지 못했어요. 배포 빌드의 브라우저 설치와 서버 자원을 확인하세요."); }
  } else try {
    browser = await chromium.launch({ channel: "msedge", headless: true, timeout: 7000 });
  } catch {
    try { browser = await chromium.launch({ channel: "chrome", headless: true, timeout: 7000 }); }
    catch { throw new Error("Instagram 화면 수집에는 설치된 Microsoft Edge 또는 Chrome이 필요해요. 브라우저 실행에 실패했습니다."); }
  }
  try {
    const context = await browser.newContext({ locale: "ko-KR", acceptDownloads: false });
    const page = await context.newPage();
    const source = `https://www.instagram.com/explore/tags/${encodeURIComponent(query)}/`;
    let links = suppliedUrls.map(instagramUrl);
    if (!links.length) {
      await page.goto(source, { waitUntil: "domcontentloaded", timeout: 8000 });
      const current = new URL(page.url());
      if (!current.hostname.endsWith("instagram.com") || /\/accounts\/login|\/challenge|\/consent|\/sorry/.test(current.pathname))
        throw new Error("Instagram이 로그인·접근 확인을 요구해 브라우저 공개 수집을 중단했어요.");
      try { await page.locator('a[href*="/reel/"], a[href*="/p/"]').first().waitFor({ state: "attached", timeout: 6000 }); }
      catch { throw new Error("Instagram 화면에서 공개 게시물 링크를 찾지 못했어요. 로그인 제한 또는 페이지 형식 변경일 수 있습니다."); }
      links = await page.locator('a[href*="/reel/"], a[href*="/p/"]').evaluateAll((anchors) => anchors
        .map((anchor) => (anchor as HTMLAnchorElement).href));
    }
    const canonical = [...new Set(links.flatMap((url) => { try { return [instagramUrl(url)]; } catch { return []; } }))].slice(0, 6);
    const results = await Promise.allSettled(canonical.map(async (url) => {
      const html = await publicHtml(url);
      return parseInstagram(html, url);
    }));
    const posts: SocialPost[] = results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
    if (!posts.length) throw new Error(`Instagram 공개 게시물 링크 ${canonical.length}개는 찾았지만 캡션과 게시 날짜를 함께 읽지 못했어요.`);
    return { posts, discovered: canonical.length,
      warnings: [`Instagram ‘${query}’: 공개 링크 ${canonical.length}개에서 날짜가 있는 게시물 ${posts.length}개를 읽었어요. 인기 목록은 최신순이 아니므로 기간 밖 자료는 주간 집계에서 제외됩니다.`] };
  } finally { await browser.close(); }
}
