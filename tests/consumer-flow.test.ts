import { describe, it, expect } from "vitest";
import data from "../content/catalog.json";
import type { Catalog, Pantry } from "../lib/types";
import { stockAmount } from "../lib/domain";
import { recommendationPantry, exclusionIds, bakeLink, savedCup, validateCup, preparationFingerprint, preparationChecks } from "../lib/consumer-flow";
const catalog = data as Catalog;
describe("소비자 화면 간 값 전달과 정직한 입력", () => {
  it("같은 재료 여러 봉지는 중복 없이 모두 합산한다", () => {
    const pantry: Pantry[] = [{ ingredientId: "flour-allpurpose", quantity: 100, unit: "g" }, { ingredientId: "flour-allpurpose", quantity: .5, unit: "kg" }];
    const result = recommendationPantry(["flour-allpurpose", "flour-allpurpose"], pantry, catalog);
    expect(result).toHaveLength(2);
    expect(stockAmount(result, { id: "flour-allpurpose", unit: "g" }, catalog).total).toBe(600);
  });
  it("개별 컵 용량과 양 미확인을 임의의 무게로 바꾸지 않는다", () => {
    const result = recommendationPantry(["water", "butter-salted"], [{ ingredientId: "water", quantity: 2, unit: "cup", cupMl: 200 }], catalog);
    expect(stockAmount(result, { id: "water", unit: "ml" }, catalog).total).toBe(400);
    expect(result[1].quantity).toBeNull();
  });
  it("선택한 재료 범위 밖의 보유 재고를 추천에 끼워 넣지 않는다", () => {
    const result = recommendationPantry(["water"], [{ ingredientId: "butter-salted", quantity: 1000, unit: "g" }], catalog);
    expect(result.map(p => p.ingredientId)).toEqual(["water"]);
  });
  it("목록 뒤쪽의 견과류도 관련 성분 제외에 포함한다", () => {
    const nuts = catalog.ingredients.filter(i => i.allergens.includes("tree-nut"));
    expect(nuts.length).toBeGreaterThan(0);
    expect(exclusionIds([], ["tree-nut"], catalog)).toEqual(expect.arrayContaining(nuts.map(i => i.id)));
  });
  it("개별 제외와 관련 성분 제외가 겹쳐도 중복하지 않는다", () => {
    const ids = exclusionIds(["flour-allpurpose"], ["wheat"], catalog);
    expect(ids.filter(id => id === "flour-allpurpose")).toHaveLength(1);
  });
  it("새 시도·이어하기 링크에 배합과 실행 ID를 보존한다", () => {
    const url = new URL(bakeLink("shortbread", { scale: 2, run: "second-attempt" }), "https://example.invalid");
    expect(url.searchParams.get("scale")).toBe("2"); expect(url.searchParams.get("run")).toBe("second-attempt");
  });
  it("수정본은 이미 조정된 배합이므로 scale을 다시 중복 적용하지 않는다", () => {
    const link = bakeLink("shortbread", { scale: 2, versionId: "edited", run: "another" });
    expect(link).toContain("version=edited"); expect(link).not.toContain("scale=");
  });
  it("용량을 확인하지 않은 컵과 범위를 벗어난 컵은 저장하지 못한다", () => {
    expect(() => validateCup("컵", 200, false)).toThrow("확인");
    expect(() => validateCup("컵", 0, true)).toThrow();
    expect(() => validateCup("컵", Infinity, true)).toThrow();
    expect(validateCup(" 내 컵 ", 200, true)).toMatchObject({ name: "내 컵", ml: 200 });
  });
  it("등록 전 컵 용량을 240ml로 가정하지 않는다", () => {
    expect(savedCup([])).toBeNull();
    expect(savedCup([{ id: "cup", kind: "cup-profile", ml: 200, name: "표시선 컵" }])?.ml).toBe(200);
  });
  it("계량 확인은 같은 배합에만 이어지고 다른 배수에는 섞이지 않는다", () => {
    const recipe = catalog.recipes[0];
    const settings = [{ id: "prep", kind: "preparation", fingerprint: preparationFingerprint(recipe), checks: [recipe.ingredients[0].id, "deleted-ingredient"] }];
    expect(preparationChecks(settings, recipe)).toEqual([recipe.ingredients[0].id]);
    const double = { ...recipe, ingredients: recipe.ingredients.map(i => ({ ...i, quantity: i.quantity * 2 })) };
    expect(preparationChecks(settings, double)).toEqual([]);
  });
});
