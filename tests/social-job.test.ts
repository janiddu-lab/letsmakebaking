import { describe, it, expect } from "vitest";
import { weekWindow, uniqueSample, relevantPost, todayPosts } from "../lib/social-job";
import type { SocialPost } from "../lib/social-trends";

const window = weekWindow(new Date("2026-10-29T05:00:00Z"));
const post = (id: string, text: string, publishedAt = "2026-10-28T04:00:00Z"): SocialPost => ({ id, text, publishedAt, platform: "bluesky", author: id, url: "https://bsky.app/" });
describe("2,000개 주간 수집", () => {
  it("오늘을 포함한 KST 7개 날짜를 고정한다", () => {
    expect(window.since).toBe("2026-10-22T15:00:00.000Z");
    expect(window.todaySince).toBe("2026-10-28T15:00:00.000Z");
  });
  it("같은 ID와 같은 내용의 재게시를 중복 제거한다", () => {
    const result = uniqueSample([post("a", "쿠키 첫 글"), post("a", "쿠키 내용 변경"), post("b", "쿠키 첫 글")], window.since, window.until);
    expect(result).toHaveLength(1);
  });
  it("청소·화학 자료로 목표 수량을 채우지 않는다", () => {
    expect(relevantPost(post("a", "베이킹소다로 청소하기"))).toBe(false);
    expect(relevantPost(post("b", "두쫀쿠 만들었어요"))).toBe(true);
  });
  it("주간 범위 밖과 미래의 게시물을 제외한다", () => {
    expect(uniqueSample([post("a", "쿠키", "2026-10-20T00:00:00Z"), post("b", "스콘", "2026-10-30T00:00:00Z")], window.since, window.until)).toEqual([]);
  });
  it("어제와 오늘을 나눠 집계한다", () => {
    expect(todayPosts([post("a", "쿠키"), post("b", "브라우니", "2026-10-29T01:00:00Z")], window.todaySince)).toHaveLength(1);
  });
  it("오늘 경계가 불확실한 상대 시각은 오늘 집계에 넣지 않는다", () => {
    const p = { ...post("a", "쿠키", "2026-10-28T15:20:00Z"), timePrecision: "relative" as const, timeRangeStart: "2026-10-28T14:50:00Z" };
    expect(todayPosts([p], window.todaySince)).toHaveLength(0);
  });
});
