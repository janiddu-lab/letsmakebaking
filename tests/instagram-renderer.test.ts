import { describe, it, expect, vi } from "vitest";
import type { Page } from "playwright-core";
import { checkInstagramLocation, openInstagramPage, renderedInstagramPost } from "../lib/instagram-renderer";
const location = "https://www.instagram.com/p/ABC123/";
function pageFixture(url = location) {
  const goto = vi.fn(async (_url: string, _options: unknown) => null);
  const waitFor = vi.fn(async () => {});
  return { goto, waitFor, page: { goto, url: () => url, locator: () => ({ waitFor }), content: async () => '<script type="application/json">{"shortcode":"ABC123","caption":{"text":"휘낭시에 구웠어요"},"taken_at":1793336400,"user":{"username":"baker"}}</script>' } as unknown as Page };
}
describe("Instagram 브라우저 수집의 대기·상세 페이지 처리", () => {
  it("전체 리소스가 아닌 문서 응답 시작까지만 기다린다", async () => {
    const f = pageFixture(); await openInstagramPage(f.page, location);
    expect(f.goto).toHaveBeenCalledWith(location, { waitUntil: "commit", timeout: 12000 });
  });
  it("상세 페이지의 브라우저 HTML에서도 캡션과 날짜를 읽는다", async () => {
    const f = pageFixture(); const posts = await renderedInstagramPost(f.page, location);
    expect(posts[0].text).toContain("휘낭시에"); expect(posts[0].publishedAt).toBeTruthy();
  });
  it.each(["https://www.instagram.com/accounts/login/", "https://www.instagram.com/challenge/", "https://evilinstagram.com/p/ABC/", "http://www.instagram.com/p/ABC/"])('%s 접근 확인과 다른 호스트에서 수집하지 않는다', url => expect(() => checkInstagramLocation(url)).toThrow());
  it("브라우저 타임아웃을 내부 호출 로그 없이 설명한다", async () => {
    const f = pageFixture(); f.goto.mockRejectedValue(new Error("page.goto: Timeout 8000ms Call log"));
    await expect(openInstagramPage(f.page, location)).rejects.toThrow("연결이 지연");
  });
});
