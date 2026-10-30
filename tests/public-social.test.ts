import { describe, it, expect, vi, afterEach } from "vitest";
import { assignedJson, relativePublished, parseYoutube, parseInstagram, instagramUrl, publicHtml } from "../lib/public-social";

// 공개 페이지 형식과 오늘 경계 판정을 검사합니다. 실제 SNS 호출은 하지 않습니다.
const since = "2026-10-28T15:00:00Z";
const until = "2026-10-29T05:00:00Z";
afterEach(() => vi.unstubAllGlobals());
describe("공개 SNS 수집", () => {
  it("중괄호가 있는 문자열도 JSON 경계를 올바르게 찾는다", () => {
    expect(assignedJson('var ytInitialData = {"title":"} 괄호", "items":[]} ;', "var ytInitialData =")?.title).toBe("} 괄호");
  });
  it("상대 시각의 범위가 오늘 안이면 추정값으로 보존한다", () => {
    expect(relativePublished("6시간 전", since, until)?.timePrecision).toBe("relative");
  });
  it("오늘 경계와 겹치는 상대 시각은 제외한다", () => {
    expect(relativePublished("14 hours ago", since, until)).toBeNull();
    expect(relativePublished("1 day ago", since, until)).toBeNull();
  });
  it("YouTube 공개 검색 JSON에서 제목·채널·상대 시각을 읽는다", () => {
    const video = { videoId: "abcdefghijk", title: { runs: [{ text: "홈베이킹 쿠키" }] }, publishedTimeText: { simpleText: "2시간 전" }, ownerText: { runs: [{ text: "채널", navigationEndpoint: { browseEndpoint: { browseId: "channel-1" } } }] } };
    const html = "var ytInitialData = " + JSON.stringify({ contents: [{ videoRenderer: video }] });
    expect(parseYoutube(html, since, until)[0]).toMatchObject({ platform: "youtube", author: "channel-1", timeLabel: "2시간 전" });
  });
  it("Instagram은 게시 시각이 있는 공개 데이터만 읽는다", () => {
    const html = '<script type="application/json">' + JSON.stringify({ shortcode: "ABC123", caption: { text: "쿠키 만들기" }, taken_at: 1793246400, user: { username: "baker" } }) + '</script>';
    expect(parseInstagram(html, "https://www.instagram.com/explore/tags/baking/")[0]).toMatchObject({ platform: "instagram", author: "baker", text: "쿠키 만들기" });
    expect(parseInstagram('<title>로그인</title>', "https://www.instagram.com/")).toEqual([]);
  });
  it("시각 없는 Instagram 메타데이터를 오늘 게시물로 만들지 않는다", () => {
    expect(parseInstagram('<meta property="og:description" content="쿠키">', "https://www.instagram.com/p/ABC123/")).toEqual([]);
  });
  it("실제 공개 상세 페이지의 날짜 표시는 오차 범위가 있는 일 단위로 보존한다", () => {
    const html = '<meta property="og:description" content="1M likes, 4262 comments - baker - October 27, 2026: &quot;쿠키 &#x1f36a; #홈베이킹&quot;.">';
    const post = parseInstagram(html, "https://www.instagram.com/reel/ABC123/")[0];
    expect(post).toMatchObject({ author: "baker", timePrecision: "day", timeLabel: "2026-10-27" });
    expect(post.text).toContain("🍪");
    expect(post.timeRangeStart).toBe("2026-10-26T10:00:00.000Z");
    expect(post.timeRangeEnd).toBe("2026-10-28T12:00:00.000Z");
  });
  it("게시물 링크를 정규화하고 외부 주소·계정정보를 거부한다", () => {
    expect(instagramUrl("https://instagram.com/reel/ABC123/?igsh=tracking")).toBe("https://www.instagram.com/reel/ABC123/");
    expect(() => instagramUrl("https://instagram.com.evil.test/p/ABC123/")).toThrow();
    expect(() => instagramUrl("https://user:pass@www.instagram.com/p/ABC123/")).toThrow();
  });
  it("로컬 주소와 로그인 리디렉션을 가져오지 않는다", async () => {
    await expect(publicHtml("http://127.0.0.1:3210/")).rejects.toThrow();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "/accounts/login/" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(publicHtml("https://www.instagram.com/p/ABC123/")).rejects.toThrow("로그인");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
