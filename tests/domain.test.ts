import { describe, it, expect } from "vitest";
import {
  adapt,
  calculateCost,
  convert,
  convertDifferentCups,
  matchRecipes,
  panFactor,
} from "../lib/domain";
import type { Catalog, MatchInput, Recipe } from "../lib/types";
import { readFileSync } from "node:fs";
const c = JSON.parse(readFileSync("content/catalog.json", "utf8")) as Catalog;
const base: Recipe = {
  id: "fixture",
  title: "검증용 배합",
  category: "cookie",
  description: "계산과 추천의 경계 조건 검증",
  difficulty: 1,
  servings: 2,
  yieldCount: 10,
  activeMin: 10,
  totalMin: 30,
  equipmentIds: ["oven"],
  appliance: "oven",
  ingredients: [
    { id: "flour-allpurpose", quantity: 100, unit: "g" },
    { id: "butter-unsalted", quantity: 50, unit: "g" },
    { id: "sugar-white", quantity: 30, unit: "g" },
  ],
  steps: [{ text: "검증용 과정", advanced: "검증용 설명" }],
  tags: [],
  sourceIds: [],
  evidence: "FORMULA_REVIEWED",
  tested: false,
  minScale: 0.25,
  maxScale: 4,
};
const fixture = { ...c, recipes: [base] };
const input = (): MatchInput => ({
  entryMode: "INGREDIENT_FIRST",
  ingredientMode: "STRICT",
  allowedIds: base.ingredients.map((i) => i.id),
  mustUseIds: [],
  excludedIds: [],
  pantry: base.ingredients.map((i) => ({
    ingredientId: i.id,
    quantity: i.quantity,
    unit: i.unit,
  })),
  equipment: ["oven"],
});
describe("엄격 검색과 보유량 판정", () => {
  it("허용 목록 밖 필수 재료를 숨겨서 추가하지 않는다", () => {
    const i = input();
    i.allowedIds.pop();
    expect(matchRecipes(i, fixture)).toHaveLength(0);
  });
  it("선택 재료를 전부 쓰지 않아도 반드시 사용할 것만 충족하면 된다", () => {
    const i = input();
    i.allowedIds.push("milk");
    i.mustUseIds = ["butter-unsalted"];
    expect(matchRecipes(i, fixture)[0].state).toBe("READY");
  });
  it("필수 포함과 제외가 겹치면 검색 전에 거절한다", () => {
    const i = input();
    i.mustUseIds = ["milk"];
    i.excludedIds = ["milk"];
    expect(() => matchRecipes(i, fixture)).toThrow(/겹쳐/);
  });
  it("보유 체크와 수량 확인을 다르게 취급한다", () => {
    const i = input();
    i.pantry[0].quantity = null;
    expect(matchRecipes(i, fixture)[0].state).toBe("UNKNOWN");
  });
  it("수량 0은 재료가 충분하다는 뜻이 아니다", () => {
    const i = input();
    i.pantry[0].quantity = 0;
    expect(matchRecipes(i, fixture)[0].state).toBe("PREPARE");
  });
  it("필수 도구가 없으면 바로 가능으로 표시하지 않는다", () => {
    const i = input();
    i.equipment = [];
    expect(matchRecipes(i, fixture)[0].state).toBe("PREPARE");
  });
  it("검토하지 않은 응용 배합은 기본 실행 추천에 섞지 않는다", () => {
    expect(
      matchRecipes(input(), {
        ...fixture,
        recipes: [{ ...base, evidence: "EDITORIAL_CHECKED" }],
      }),
    ).toHaveLength(0);
  });
  it("응용을 명시적으로 열어도 바로 가능으로 승격하지 않는다", () => {
    const i = input();
    i.filters = { exploratory: true };
    expect(
      matchRecipes(i, {
        ...fixture,
        recipes: [{ ...base, evidence: "EDITORIAL_CHECKED" }],
      })[0].state,
    ).toBe("UNKNOWN");
  });
  it("필터는 순위 점수보다 우선한다", () => {
    const i = input();
    i.filters = { maxTotalMinutes: 20 };
    expect(matchRecipes(i, fixture)).toHaveLength(0);
  });
});
describe("단위·팬·원가의 정확한 계산", () => {
  it("같은 높이의 원형 팬 지름을 절반으로 바꾸면 배합은 1/4이다", () => {
    expect(
      panFactor({ shape: "round", width: 20 }, { shape: "round", width: 10 }),
    ).toBe(0.25);
  });
  it("직사각 팬에는 세로 길이가 필요하다", () => {
    expect(() =>
      panFactor({ shape: "rect", width: 20 }, { shape: "rect", width: 10 }),
    ).toThrow();
  });
  it("부피와 무게는 재료별 밀도를 사용한다", () => {
    expect(
      convert(100, "ml", "g", { ...c.ingredients[0], gramsPerMl: 0.5 }),
    ).toBe(50);
    expect(
      convert(100, "ml", "g", { ...c.ingredients[0], gramsPerMl: 0.8 }),
    ).toBe(80);
  });
  it("같은 컵 표기도 실제 용량이 다르면 같은 양으로 취급하지 않는다", () => {
    expect(convertDifferentCups(1, "cup", "cup", undefined, 200, 250)).toBe(
      0.8,
    );
  });
  it("근거 없는 부피와 무게 환산을 거절한다", () => {
    expect(() => convert(1, "cup", "g")).toThrow(/근거/);
  });
  it("정밀 계량 재료는 숟가락 무게 환산을 거절한다", () => {
    expect(() =>
      convert(1, "tsp", "g", {
        ...c.ingredients[0],
        spoonSafe: false,
        gramsPerMl: 1,
      }),
    ).toThrow(/민감/);
  });
  it("달걀 가식부 기준이 있어야 부분량을 환산한다", () => {
    expect(
      convert(0.5, "ea", "g", { ...c.ingredients[0], gramsPerEach: 50 }),
    ).toBe(25);
  });
  it("음수와 무한대 수량을 거절한다", () => {
    expect(() => convert(-1, "g", "g")).toThrow();
    expect(() => convert(Infinity, "g", "g")).toThrow();
  });
  it("사용 원가와 포장 단위 구매 지출을 구분한다", () => {
    const recipe = {
      ...base,
      ingredients: [{ id: "flour-allpurpose", quantity: 250, unit: "g" }],
    };
    const result = calculateCost(
      recipe,
      1,
      [
        {
          ingredientId: "flour-allpurpose",
          packageQuantity: 1000,
          packageUnit: "g",
          packagePrice: 2000,
        },
      ],
      [{ ingredientId: "flour-allpurpose", quantity: 50, unit: "g" }],
      c,
    );
    expect(result.total).toBe(500);
    expect(result.additional).toBe(2000);
    expect(result.lines[0].missing).toBe(200);
  });
  it("가격 누락은 0원 완성 총액이 아니다", () => {
    const result = calculateCost(base, 1, [], [], c);
    expect(result.incomplete).toBe(true);
    expect(result.additionalIncomplete).toBe(true);
  });
  it("분모가 0인 포장량으로 비용을 생성하지 않는다", () => {
    const result = calculateCost(
      base,
      1,
      [
        {
          ingredientId: "flour-allpurpose",
          packageQuantity: 0,
          packagePrice: 2000,
          packageUnit: "g",
        },
      ],
      [],
      c,
    );
    expect(result.lines[0].cost).toBeNull();
  });
});
describe("대체와 원본 보존", () => {
  const rule = {
    id: "r",
    kind: "ingredient",
    fromId: "butter-unsalted",
    to: [{ id: "butter-salted", ratio: 1 }],
    contexts: ["cookie"],
    description: "검증용 대체",
    conditions: "염분 확인",
    changes: "염분을 별도 검토",
    limits: "직접 제조 미검증",
    evidence: "conditional",
    sourceIds: [],
  };
  it("분량을 바꿔도 원본을 덮어쓰지 않는다", () => {
    const before = JSON.stringify(base);
    const result = adapt(base, [], c, 0.5);
    expect(result.recipe.ingredients[0].quantity).toBe(50);
    expect(JSON.stringify(base)).toBe(before);
  });
  it("대체가 과정을 바꾸면 수정 안내도 함께 생성한다", () => {
    const result = adapt(base, [rule], c);
    expect(
      result.recipe.ingredients.some((i) => i.id === "butter-salted"),
    ).toBe(true);
    expect(result.changes[0]).toContain("염분");
    expect(result.recipe.steps.at(-1)?.text).toContain("염분");
  });
  it("세 가지 동시 대체를 자동 승인하지 않는다", () => {
    expect(() =>
      adapt(base, [rule, { ...rule, id: "r2" }, { ...rule, id: "r3" }], c),
    ).toThrow(/세 가지/);
  });
  it("같은 재료에 두 대체를 동시에 적용할 수 없다", () => {
    expect(() => adapt(base, [rule, { ...rule, id: "r2" }], c)).toThrow(
      /두 번/,
    );
  });
  it("적용 맥락이 다른 대체는 거절한다", () => {
    expect(() => adapt(base, [{ ...rule, contexts: ["bread"] }], c)).toThrow(
      /근거/,
    );
  });
  it("최소 배치보다 작게 줄이지 않는다", () => {
    expect(() => adapt(base, [], c, 0.1)).toThrow(/범위/);
  });
});
describe("콘텐츠와 자산 참조", () => {
  it("레시피 수와 모든 필수 재료·도구·출처 참조가 유효하다", () => {
    expect(c.recipes).toHaveLength(36);
    for (const r of c.recipes) {
      expect(r.ingredients.length).toBeGreaterThan(0);
      expect(r.steps.length).toBeGreaterThan(0);
      for (const i of r.ingredients) {
        expect(
          c.ingredients.some((x) => x.id === i.id),
          `${r.id}:${i.id}`,
        ).toBe(true);
        expect(i.quantity).toBeGreaterThan(0);
      }
      for (const id of r.equipmentIds)
        expect(c.equipment.some((x) => x.id === id)).toBe(true);
      for (const id of r.sourceIds)
        expect(c.sources.some((x) => x.id === id)).toBe(true);
      expect(r.tested).toBe(false);
    }
  });
  it("현재 트렌드로 가장한 예시가 없다", () => {
    for (const trend of c.trends) expect(trend.isDemo).toBe(true);
  });
});
