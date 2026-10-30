import { chromium, type Page } from "playwright-core";
import { instagramUrl, parseInstagram, publicHtml } from "./public-social";
import type { SocialPost } from "./social-trends";
import type { CollectionObserver } from "./collection-live";
import { streamBrowserPage } from "./collection-stream";

export function checkInstagramLocation(location: string) {
  const url = new URL(location);
  if (url.protocol !== "https:" || !["www.instagram.com", "instagram.com"].includes(url.hostname) || /\/accounts\/login|\/challenge|\/consent|\/sorry/.test(url.pathname)) throw new Error("Instagram이 로그인·접근 확인을 요구해 브라우저 공개 수집을 중단했어요.");
}
export async function openInstagramPage(page: Page, url: string, timeout = 12000) {
  try { await page.goto(url, { waitUntil: "commit", timeout }); }
  catch { throw new Error("Instagram 연결이 지연되어 페이지를 열지 못했어요. 잠시 후 해당 검색어를 다시 시도해 주세요."); }
  checkInstagramLocation(page.url());
}
export async function renderedInstagramPost(page: Page, url: string, timeout = 7000, showPage = false) {
  await openInstagramPage(page, url, timeout);
  await page.locator('meta[property="og:description"]').waitFor({ state: "attached", timeout: Math.min(timeout, 5000) }).catch(() => {});
  checkInstagramLocation(page.url());
  if (showPage) {
    await page.locator("main,article").first().waitFor({ state: "visible", timeout: 1500 }).catch(() => {});
    // 공개 페이지에서 닫을 수 있는 안내만 닫고 실제 내용을 읽으며 스크롤합니다.
    await page.getByRole("button", { name: /^(닫기|close)$/i }).first().click({ timeout: 300 }).catch(() => {});
    await page.mouse.wheel(0, 420);
  }
  return parseInstagram(await page.content(), url);
}

// 앱 기능으로 실행하는 독립 브라우저입니다. 사용자의 기존 브라우저 프로필·쿠키를 읽지 않습니다.
export async function renderInstagram(query: string, suppliedUrls: string[] = [], observer?: CollectionObserver, demo = false, streamId?: string) {
  observer?.({ stage: "browser", message: "독립 Chromium 브라우저를 실행합니다.", query, platform: "instagram" });
  let browser;
  if (process.platform === "linux") {
    // 무료 서버는 첫 실행에 시간이 걸려 페이지 조회와 별도로 시작 여유를 줍니다.
    try { browser = await chromium.launch({ headless: true, timeout: 20000, args: ["--disable-dev-shm-usage"] }); }
    catch (error) {
      console.error("Instagram browser startup failed", error);
      const timeout = /timeout/i.test(error instanceof Error ? error.message : "");
      throw new Error(timeout ? "서버 자원이 부족해 Chromium 시작이 20초 안에 완료되지 않았어요. 잠시 후 다시 시도해 주세요." : "서버용 Chromium을 실행하지 못했어요. 배포 빌드의 브라우저 설치와 서버 자원을 확인하세요.");
    }
  } else try {
    browser = await chromium.launch({ channel: "msedge", headless: true, timeout: 7000 });
  } catch {
    try { browser = await chromium.launch({ channel: "chrome", headless: true, timeout: 7000 }); }
    catch { throw new Error("Instagram 화면 수집에는 설치된 Microsoft Edge 또는 Chrome이 필요해요. 브라우저 실행에 실패했습니다."); }
  }
  let stopStream: (() => Promise<void>) | undefined;
  try {
    const context = await browser.newContext({ locale: "ko-KR", acceptDownloads: false, serviceWorkers: "block", viewport: { width: 960, height: 600 } });
    // 화면을 볼 때는 게시물 이미지를 그대로 표시하며 동영상 자동 재생은 막습니다.
    await context.route("**/*", route => (demo ? ["media", "font"] : ["image", "media", "font"]).includes(route.request().resourceType()) ? route.abort() : route.continue());
    const deadline = Date.now() + 50000;
    const page = await context.newPage();
    if (demo && streamId) stopStream = await streamBrowserPage(page, streamId).catch(() => undefined);
    const source = `https://www.instagram.com/explore/tags/${encodeURIComponent(query)}/`;
    let links = suppliedUrls.map(instagramUrl);
    if (!links.length) {
      await openInstagramPage(page, source);
      observer?.({ stage: "browser", message: "공개 검색 화면의 게시물 링크를 기다립니다.", platform: "instagram", query, url: source });
      try { await page.locator('a[href*="/reel/"], a[href*="/p/"]').first().waitFor({ state: "attached", timeout: 12000 }); }
      catch { checkInstagramLocation(page.url()); throw new Error("Instagram 화면에서 공개 게시물 링크를 찾지 못했어요. 로그인 제한 또는 페이지 형식 변경일 수 있습니다."); }
      checkInstagramLocation(page.url());
      links = await page.locator('a[href*="/reel/"], a[href*="/p/"]').evaluateAll((anchors) => anchors
        .map((anchor) => (anchor as HTMLAnchorElement).href));
    }
    const canonical = [...new Set(links.flatMap((url) => { try { return [instagramUrl(url)]; } catch { return []; } }))].slice(0, 6);
    observer?.({ stage: "links", message: `공개 링크 ${canonical.length}개를 확인했습니다.`, platform: "instagram", query });
    const visual = demo ? canonical : [];
    const results = await Promise.allSettled(canonical.filter(url => !visual.includes(url)).map(async (url) => {
      const html = await publicHtml(url);
      return parseInstagram(html, url);
    }));
    const posts: SocialPost[] = results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
    for (const url of visual) {
      if (deadline - Date.now() < 4000) break;
      observer?.({ stage: "post", message: "시연 모드: 실제 게시물을 브라우저로 열어 캡션과 날짜를 읽습니다.", platform: "instagram", query, url });
      try { posts.push(...await renderedInstagramPost(page, url, 4500, true)); }
      catch (e) { observer?.({ stage: "error", message: e instanceof Error ? e.message : "게시물 화면을 읽지 못했습니다.", platform: "instagram", query, url }); if (/로그인.*요구|접근 확인.*요구/.test(e instanceof Error ? e.message : "")) throw e; }
    }
    // 상세 HTML이 비어 있으면 같은 독립 브라우저에서도 읽습니다. 재시도는 두 건까지만 합니다.
    const missing = canonical.filter(url => !posts.some(p => p.url === url || p.id.endsWith(new URL(url).pathname.split("/")[2]))).slice(0, 2);
    for (const url of missing) {
      if (deadline - Date.now() < 5000) break;
      try { posts.push(...await renderedInstagramPost(page, url, Math.min(7000, Math.floor((deadline - Date.now()) / 2)))); }
      catch (error) { if (/로그인.*요구|접근 확인.*요구/.test(error instanceof Error ? error.message : "")) throw error; }
    }
    if (!posts.length) throw new Error(`Instagram 공개 게시물 링크 ${canonical.length}개는 찾았지만 캡션과 게시 날짜를 함께 읽지 못했어요.`);
    return { posts, discovered: canonical.length,
      warnings: [`Instagram ‘${query}’: 공개 링크 ${canonical.length}개에서 날짜가 있는 게시물 ${posts.length}개를 읽었어요. 인기 목록은 최신순이 아니므로 기간 밖 자료는 주간 집계에서 제외됩니다.`] };
  } finally { await stopStream?.(); await browser.close(); }
}
