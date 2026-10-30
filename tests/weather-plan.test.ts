import { describe, it, expect } from "vitest";
import data from "../content/catalog.json";
import type { Catalog, Recipe } from "../lib/types";
import { weatherPlan, weatherCandidates } from "../lib/weather-plan";
const catalog = data as Catalog;
const recipe = (id: string) => catalog.recipes.find(r => r.id === id)!;
describe("온습도를 다음 베이킹 행동으로 연결", () => {
  it("더운 주방의 버터 쿠키는 반죽 상태·소분·냉장 관찰로 안내한다", () => {
    const plan = weatherPlan(recipe("shortbread"), 30, 55);
    const cookie = plan.steps.find(s => s.id === "cookie")!;
    expect(cookie.prepare).toContain("나눠 꺼내"); expect(cookie.next).toContain("냉장"); expect(cookie.next).toContain("밀가루를 임의로");
  });
  it("녹인 버터 쿠키에 무조건 차가운 버터를 사용하라고 하지 않는다", () => expect(weatherPlan(recipe("choc-chip-cookie"), 30, 50).steps[0].prepare).toContain("녹인 버터를 쓰는 배합도 원문의"));
  it("차가운 날 이스트 빵은 부피·촉감 관찰로 연결한다", () => {
    const proof = weatherPlan(recipe("sandwich-bread"), 15, 50).steps.find(s => s.id === "proof")!;
    expect(proof.title).toContain("차가운"); expect(proof.check).toContain("모든 빵이 두 배"); expect(proof.href).toBe("/learn/basic-proof");
  });
  it("바나나 브레드는 이름이 빵이어도 이스트 발효로 안내하지 않는다", () => expect(weatherPlan(recipe("banana-loaf"), 15, 50).steps.some(s => s.id === "proof")).toBe(false));
  it("높은 습도의 머랭·아이싱은 건조 상태와 포장을 확인한다", () => {
    const plan = weatherPlan(null, 24, 80, "icing");
    expect(plan.steps[0].title).toContain("건조"); expect(plan.steps[0].next).toContain("포장을 미루고"); expect(plan.steps[0].href).toBe("/learn/icing-consistency");
  });
  it("스콘의 작업 상태도 원문에 따라 차갑게 관리한다", () => expect(weatherPlan(recipe("plain-scone"), 29, 55).steps[0].id).toBe("scone"));
  it("더운 날 후보는 버터 작업 부담이 없는 실제 레시피로 구성한다", () => {
    const result = weatherCandidates(catalog.recipes, 30, 50);
    expect(result).toHaveLength(3); expect(result.every(r => !r.recipe.ingredients.some(i => i.id.startsWith("butter-")))).toBe(true);
  });
  it("추운 날 후보에 이스트 발효 메뉴를 우선하지 않는다", () => expect(weatherCandidates(catalog.recipes, 15, 50).every(r => !r.recipe.ingredients.some(i => i.id === "yeast" || i.id === "yeast-active"))).toBe(true));
  it("안내를 만들어도 원본 배합·단계·시간은 바꾸지 않는다", () => {
    const original = recipe("shortbread"), snapshot = JSON.stringify(original);
    weatherPlan(original, 32, 80); weatherCandidates(catalog.recipes, 32, 80);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
  it("계량 범위를 벗어난 입력은 유효한 계획으로 생성하지 않는다", () => {
    expect(() => weatherPlan(recipe("shortbread"), NaN, 50)).toThrow(); expect(() => weatherCandidates(catalog.recipes, 23, 120)).toThrow();
  });
  it("작업 안내 링크는 카탈로그 또는 실제 학습 자료에 존재한다", () => {
    const plans = [...catalog.recipes.map(r => weatherPlan(r, 30, 80)), weatherPlan(null, 30, 80, "icing")];
    for (const p of plans) for (const step of p.steps) if (step.href.startsWith("/learn/")) expect(catalog.articles.some(a => step.href === `/learn/${a.id}`)).toBe(true);
  });
});
