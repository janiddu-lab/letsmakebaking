import { describe, it, expect } from "vitest";
import { productNames } from "../lib/trend-products";
import { summarizeSocial, type SocialPost } from "../lib/social-trends";

const since = "2026-10-28T15:00:00Z", until = "2026-10-29T05:00:00Z";
const post = (id: string, text: string, author = id): SocialPost => ({ id, text, author, platform: "youtube", url: "https://www.youtube.com/watch?v=abcdefghijk", publishedAt: "2026-10-29T01:00:00Z" });
describe("제품명과 해시태그 분리", () => {
  it("두쫀쿠의 별칭을 같은 제품으로 묶는다", () => {
    expect(productNames("두쫀쿠와 두바이 쫀득 쿠키 만들기").products).toEqual(["두쫀쿠"]);
  });
  it("상하이 버터떡과 일반 버터떡을 중복 집계하지 않는다", () => {
    expect(productNames("오늘 상하이 버터떡 먹음").products).toEqual(["상하이 버터떡"]);
  });
  it("일반 해시태그를 제품명 순위에 넣지 않는다", () => {
    const result = summarizeSocial([post("1", "#artisan #baking #두쫀쿠")], since, until);
    expect(result.keywords.map((x) => x.keyword)).toEqual(["두쫀쿠"]);
    expect(result.hashtags.map((x) => x.keyword)).not.toContain("artisan");
    expect(result.hashtags.map((x) => x.keyword)).toContain("두쫀쿠");
  });
  it("사전에 있다는 이유로 실제 언급이 없는 제품을 만들지 않는다", () => {
    expect(summarizeSocial([post("1", "오늘의 이야기")], since, until).keywords).toEqual([]);
  });
  it("같은 게시물의 반복 언급과 동일 문장 재게시를 중복 제거한다", () => {
    const result = summarizeSocial([post("1", "두쫀쿠 두쫀쿠 #두쫀쿠"), post("2", "두쫀쿠 두쫀쿠 #두쫀쿠")], since, until);
    expect(result.keywords[0].count).toBe(1);
  });
  it("사전에 없는 복합 제품명은 확인할 후보로 분리한다", () => {
    const result = productNames("오늘은 말차구름쿠키");
    expect(result.candidates).toContain("말차구름쿠키");
    expect(result.products).not.toContain("말차구름쿠키");
  });
});
