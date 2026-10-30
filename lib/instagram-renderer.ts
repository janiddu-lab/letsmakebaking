import { chromium, type Page } from "playwright-core";
import { instagramUrl, parseInstagram, publicHtml } from "./public-social";
import type { SocialPost } from "./social-trends";

export function checkInstagramLocation(location: string) {
  const url = new URL(location);
  if (url.protocol !== "https:" || !["www.instagram.com", "instagram.com"].includes(url.hostname) || /\/accounts\/login|\/challenge|\/consent|\/sorry/.test(url.pathname)) throw new Error("Instagram이 로그인·접근 확인을 요구해 브라우저 공개 수집을 중단했어요.");
}
export async function openInstagramPage(page: Page, url: string, timeout = 12000) {
  try { await page.goto(url, { waitUntil: "commit", timeout }); }
  catch { throw new Error("Instagram 연결이 지연되어 페이지를 열지 못했어요. 잠시 후 해당 검색어를 다시 시도해 주세요."); }
  checkInstagramLocation(page.url());
}
export async function renderedInstagramPost(page: Page, url: string, timeout = 7000) {
  await openInstagramPage(page, url, timeout);
  await page.locator('meta[property="og:description"]').waitFor({ state: "attached", timeout: Math.min(timeout, 5000) }).catch(() => {});
  checkInstagramLocation(page.url());
  return parseInstagram(await page.content(), url);
}

// 앱 기능으로 실행하는 독립 브라우저입니다. 사용자의 기존 브라우저 프로필·쿠키를 읽지 않습니다.
export async function renderInstagram(query: string, suppliedUrls: string[] = []) {
  let browser;
  if (process.platform === "linux") {
    try { browser = await chromium.launch({ headless: true, timeout: 7000, args: ["--disable-dev-shm-usage"] }); }
    catch { throw new Error("서버용 Chromium을 실행하지 못했어요. 배포 빌드의 브라우저 설치와 서버 자원을 확인하세요."); }
  } else try {
    browser = await chromium.launch({ channel: "msedge", headless: true, timeout: 7000 });
  } catch {
    try { browser = await chromium.launch({ channel: "chrome", headless: true, timeout: 7000 }); }
    catch { throw new Error("Instagram 화면 수집에는 설치된 Microsoft Edge 또는 Chrome이 필요해요. 브라우저 실행에 실패했습니다."); }
  }
  try {
    const context = await browser.newContext({ locale: "ko-KR", acceptDownloads: false, serviceWorkers: "block" });
    // 캡션 조회에 필요 없는 영상·이미지·글꼴 요청을 줄여 서버 자원을 아낍니다.
    await context.route("**/*", route => ["image", "media", "font"].includes(route.request().resourceType()) ? route.abort() : route.continue());
    const deadline = Date.now() + 50000;
    const page = await context.newPage();
    const source = `https://www.instagram.com/explore/tags/${encodeURIComponent(query)}/`;
    let links = suppliedUrls.map(instagramUrl);
    if (!links.length) {
      await openInstagramPage(page, source);
      try { await page.locator('a[href*="/reel/"], a[href*="/p/"]').first().waitFor({ state: "attached", timeout: 12000 }); }
      catch { checkInstagramLocation(page.url()); throw new Error("Instagram 화면에서 공개 게시물 링크를 찾지 못했어요. 로그인 제한 또는 페이지 형식 변경일 수 있습니다."); }
      checkInstagramLocation(page.url());
      links = await page.locator('a[href*="/reel/"], a[href*="/p/"]').evaluateAll((anchors) => anchors
        .map((anchor) => (anchor as HTMLAnchorElement).href));
    }
    const canonical = [...new Set(links.flatMap((url) => { try { return [instagramUrl(url)]; } catch { return []; } }))].slice(0, 6);
    const results = await Promise.allSettled(canonical.map(async (url) => {
      const html = await publicHtml(url);
      return parseInstagram(html, url);
    }));
    const posts: SocialPost[] = results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
    // 상세 HTML이 비어 있으면 같은 독립 브라우저에서도 읽습니다. 재시도는 두 건까지만 합니다.
    const missing = canonical.filter((_, i) => results[i].status === "rejected" || (results[i] as PromiseFulfilledResult<SocialPost[]>).value.length === 0).slice(0, 2);
    for (const url of missing) {
      if (deadline - Date.now() < 5000) break;
      try { posts.push(...await renderedInstagramPost(page, url, Math.min(7000, Math.floor((deadline - Date.now()) / 2)))); }
      catch (error) { if (/로그인.*요구|접근 확인.*요구/.test(error instanceof Error ? error.message : "")) throw error; }
    }
    if (!posts.length) throw new Error(`Instagram 공개 게시물 링크 ${canonical.length}개는 찾았지만 캡션과 게시 날짜를 함께 읽지 못했어요.`);
    return { posts, discovered: canonical.length,
      warnings: [`Instagram ‘${query}’: 공개 링크 ${canonical.length}개에서 날짜가 있는 게시물 ${posts.length}개를 읽었어요. 인기 목록은 최신순이 아니므로 기간 밖 자료는 주간 집계에서 제외됩니다.`] };
  } finally { await browser.close(); }
}
