import { describe, it, expect } from "vitest";
import { bakingHashtags, isBakingRelated } from "../lib/baking-relevance";
import { summarizeSocial } from "../lib/social-trends";

describe("제과제빵 전용 필터", () => {
  it.each(["굿스마 보안빵구나서 카드번호 정보 다털렸다고", "이런 어린 붕어빵까지 남획되고 있다니", "쿠키뉴스 오늘의 정치", "타이어 빵꾸 났어요", "보안빵 사건 공지"])('실제 화면에서 발견된 비식품 동음이의어를 제외한다: %s', text => expect(isBakingRelated(text)).toBe(false));
  it("새로운 빵 이름도 실제 굽기 문맥이 있으면 남긴다", () => expect(isBakingRelated("밤단팥크림빵 구웠어요 #홈베이킹")).toBe(true));
  it.each(["쿠키런킹덤 공략 #쿠킹덤", "쿠키클리커 게임", "베이킹소다로 청소하기", "섹트 #쿠키 #섹블", "baked chicken and mac and cheese"])('관련 없는 글을 제외한다: %s', (text) => expect(isBakingRelated(text)).toBe(false));
  it("베이킹 글에 함께 붙은 무관한 태그도 제외한다", () => {
    expect(bakingHashtags("두쫀쿠 만들기 #두쫀쿠 #홈베이킹 #artisan #foodie #halloween #일상 #맛집 #organic")).toEqual(["두쫀쿠", "홈베이킹"]);
  });
  it("명확한 제품·기술 태그를 유지한다", () => {
    expect(bakingHashtags("쿠키를 구워요 #cookies #royalicing #breadmaking #초보베이킹")).toHaveLength(4);
  });
  it("저장된 자료도 분석할 때 다시 필터링한다", () => {
    const base = { platform: "bluesky", author: "baker", url: "https://bsky.app/", publishedAt: "2026-10-30T01:00:00Z" };
    const result = summarizeSocial([{ ...base, id: "1", text: "쿠키런킹덤 공략" }, { ...base, id: "2", text: "소금빵 구웠어요 #홈베이킹 #foodie" }], "2026-10-29T15:00:00Z", "2026-10-30T02:00:00Z");
    expect(result.posts).toHaveLength(1);
    expect(result.keywords.map((x) => x.keyword)).toEqual(["소금빵"]);
    expect(result.hashtags.map((x) => x.keyword)).toEqual(["홈베이킹"]);
  });
});
