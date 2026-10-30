import Decimal from "decimal.js";
import {
  AppError,
  type Catalog,
  type Ingredient,
  type MatchInput,
  type Pantry,
  type Recipe,
  type Rule,
} from "./types";

const D = (value: number | string) => new Decimal(value);
export const rounded = (value: Decimal | number, places = 2) =>
  new Decimal(value).toDecimalPlaces(places).toNumber();
// 부피와 무게는 같은 차원이 아닙니다. 재료별 근거가 있을 때에만 연결합니다.
export function convert(
  amount: number | string,
  from: string,
  to: string,
  ingredient?: Ingredient,
  cupMl = 240,
): number {
  const n = D(amount);
  if (!n.isFinite() || n.isNegative())
    throw new AppError(
      "INVALID_QUANTITY",
      "수량은 0 이상의 숫자로 입력해 주세요.",
    );
  if (from === to) return n.toNumber();
  const weights: Record<string, number> = { g: 1, kg: 1000 };
  const volumes: Record<string, number> = {
    ml: 1,
    L: 1000,
    tsp: 5,
    tbsp: 15,
    cup: cupMl,
  };
  if (weights[from] && weights[to])
    return n.mul(weights[from]).div(weights[to]).toNumber();
  if (volumes[from] && volumes[to])
    return n.mul(volumes[from]).div(volumes[to]).toNumber();
  // 소량 팽창제는 가정용 숟가락의 오차가 커서 저울을 먼저 권합니다.
  if (
    ingredient?.spoonSafe === false &&
    (["tsp", "tbsp", "cup"].includes(from) ||
      ["tsp", "tbsp", "cup"].includes(to))
  )
    throw new AppError(
      "UNIT_CONVERSION_UNAVAILABLE",
      "이 재료는 소량 계량에 민감해 숟가락 환산을 제공하지 않아요.",
    );
  const density = ingredient?.gramsPerMl;
  if (weights[from] && volumes[to] && density)
    return n.mul(weights[from]).div(density).div(volumes[to]).toNumber();
  if (volumes[from] && weights[to] && density)
    return n.mul(volumes[from]).mul(density).div(weights[to]).toNumber();
  if (from === "ea" && ingredient?.gramsPerEach)
    return convert(
      n.mul(ingredient.gramsPerEach).toString(),
      "g",
      to,
      ingredient,
      cupMl,
    );
  if (to === "ea" && ingredient?.gramsPerEach)
    return D(convert(amount, from, "g", ingredient, cupMl))
      .div(ingredient.gramsPerEach)
      .toNumber();
  throw new AppError(
    "UNIT_CONVERSION_UNAVAILABLE",
    "재료별 환산 근거가 없어요. 무게 또는 정확한 용량을 입력해 주세요.",
  );
}
export function convertDifferentCups(
  amount: number | string,
  from: string,
  to: string,
  ingredient?: Ingredient,
  fromCupMl = 240,
  toCupMl = 240,
) {
  // 같은 'cup' 표기라도 내 컵과 원문 컵의 실제 용량은 다를 수 있습니다.
  return from === "cup"
    ? convert(
        D(amount).mul(fromCupMl).toString(),
        "ml",
        to,
        ingredient,
        toCupMl,
      )
    : convert(amount, from, to, ingredient, toCupMl);
}
export function stockAmount(
  pantry: Pantry[],
  item: { id: string; unit: string },
  catalog: Catalog,
  recipeCupMl = 240,
) {
  const lots = pantry.filter((p) => p.ingredientId === item.id);
  let total = D(0),
    unknown = false;
  for (const lot of lots) {
    if (lot.quantity === null || lot.quantity === "") {
      unknown = true;
      continue;
    }
    try {
      total = total.add(
        convertDifferentCups(
          lot.quantity,
          lot.unit,
          item.unit,
          catalog.ingredients.find((i) => i.id === item.id),
          lot.cupMl ?? 240,
          recipeCupMl,
        ),
      );
    } catch {
      unknown = true;
    }
  }
  return {
    total: total.toNumber(),
    unknown,
    present: lots.some(
      (p) => p.quantity === null || p.quantity === "" || Number(p.quantity) > 0,
    ),
  };
}
// 사용한 양의 비용과 부족분을 사는 포장 가격은 다르므로 따로 계산합니다.
export function calculateCost(
  recipe: Recipe,
  scale: number,
  prices: any[],
  pantry: Pantry[],
  catalog: Catalog,
  extras = 0,
) {
  if (!Number.isFinite(scale) || scale <= 0 || extras < 0)
    throw new AppError("INVALID_QUANTITY", "배수와 비용을 확인해 주세요.");
  let sum = D(0),
    buy = D(0);
  const unknown: string[] = [];
  const lines = recipe.ingredients
    .filter((x) => !x.optional)
    .map((item) => {
      const amount = D(item.quantity).mul(scale);
      const price = [...prices]
        .reverse()
        .find((p) => p.ingredientId === item.id);
      const stock = stockAmount(pantry, item, catalog, recipe.cupMl ?? 240);
      let cost: number | null = null,
        purchase: number | null = null,
        packs: number | null = null;
      if (
        price &&
        Number(price.packageQuantity) > 0 &&
        Number(price.packagePrice) >= 0 &&
        (!price.currency || price.currency === "KRW")
      ) {
        try {
          const used = convertDifferentCups(
            amount.toString(),
            item.unit,
            price.packageUnit,
            catalog.ingredients.find((i) => i.id === item.id),
            recipe.cupMl ?? 240,
          );
          const unitPrice = D(price.packagePrice).div(price.packageQuantity);
          cost = rounded(unitPrice.mul(used));
          sum = sum.add(unitPrice.mul(used));
          if (!stock.unknown || stock.total >= amount.toNumber()) {
            const deficit = Math.max(amount.toNumber() - stock.total, 0);
            packs = Math.ceil(
              convertDifferentCups(
                deficit,
                item.unit,
                price.packageUnit,
                catalog.ingredients.find((i) => i.id === item.id),
                recipe.cupMl ?? 240,
              ) / Number(price.packageQuantity),
            );
            purchase = rounded(D(packs).mul(price.packagePrice));
            buy = buy.add(purchase);
          }
        } catch {
          unknown.push(item.id);
        }
      } else unknown.push(item.id);
      return {
        ...item,
        amount: amount.toString(),
        cost,
        purchase,
        packs,
        missing: Math.max(0, amount.toNumber() - stock.total),
      };
    });
  return {
    lines,
    total: rounded(sum.add(extras)),
    perItem: rounded(sum.add(extras).div(D(recipe.yieldCount).mul(scale))),
    additional: rounded(buy),
    incomplete: unknown.length > 0,
    unknown,
    additionalIncomplete: lines.some((l) => l.purchase === null),
    currency: "KRW",
  };
}
// 같은 두께의 반죽을 유지하는 면적 비율만 계산합니다. 굽기 시간을 곱하지 않습니다.
export function panFactor(
  original: { shape: string; width: number; height?: number },
  next: { shape: string; width: number; height?: number },
) {
  const area = (p: typeof original) => {
    if (p.width <= 0 || !Number.isFinite(p.width))
      throw new AppError("INVALID_QUANTITY", "팬 크기를 확인해 주세요.");
    if (p.shape === "round") return D(p.width).div(2).pow(2).mul(Math.PI);
    if (!p.height || p.height <= 0)
      throw new AppError(
        "INVALID_QUANTITY",
        "직사각 팬은 가로와 세로가 필요해요.",
      );
    return D(p.width).mul(p.height);
  };
  return rounded(area(next).div(area(original)), 8);
}
export function combineForShopping(
  recipes: Recipe[],
  catalog: Catalog,
): Recipe {
  if (!recipes.length)
    throw new AppError("NO_RECIPES", "장보기로 합칠 레시피를 선택해 주세요.");
  const grouped = new Map<string, Recipe["ingredients"][number]>();
  for (const recipe of recipes)
    for (const item of recipe.ingredients.filter((i) => !i.optional)) {
      const ingredient = catalog.ingredients.find((i) => i.id === item.id);
      let unit = ingredient?.unit ?? item.unit;
      let quantity: number;
      try {
        quantity = convertDifferentCups(
          item.quantity,
          item.unit,
          unit,
          ingredient,
          recipe.cupMl ?? 240,
        );
      } catch {
        unit = item.unit === "cup" ? "ml" : item.unit;
        quantity =
          item.unit === "cup"
            ? item.quantity * (recipe.cupMl ?? 240)
            : item.quantity;
      }
      const key = `${item.id}:${unit}`;
      const prior = grouped.get(key);
      grouped.set(key, {
        id: item.id,
        quantity: rounded(D(prior?.quantity ?? 0).add(quantity), 8),
        unit,
      });
    }
  return {
    ...recipes[0],
    id: "shopping-basket",
    title: "여러 메뉴 장보기",
    yieldCount: 1,
    servings: 1,
    cupMl: 240,
    ingredients: [...grouped.values()],
  };
}
// 원본을 복제한 다음 변경합니다. 서로 물리는 연쇄 대체나 세 가지 이상 변경은 거절합니다.
export function adapt(
  recipe: Recipe,
  rules: Rule[],
  catalog: Catalog,
  scale = 1,
) {
  if (
    !Number.isFinite(scale) ||
    scale < (recipe.minScale ?? 0.25) ||
    scale > (recipe.maxScale ?? 4)
  )
    throw new AppError(
      "UNSUPPORTED_ADAPTATION",
      "이 레시피의 권장 배합 범위를 벗어났어요.",
    );
  if (rules.length > 2)
    throw new AppError(
      "UNSUPPORTED_ADAPTATION",
      "동시에 세 가지 이상 바꾸면 상호작용을 확인하기 어려워요.",
    );
  const ids = rules.map((r) => r.fromId);
  if (new Set(ids).size !== ids.length)
    throw new AppError(
      "UNSUPPORTED_ADAPTATION",
      "같은 재료를 두 번 대체할 수 없어요.",
    );
  const result: Recipe = structuredClone(recipe);
  const changes: string[] = [];
  for (const rule of rules) {
    if (
      rule.evidence === "insufficient" ||
      (!rule.contexts.includes(recipe.category) &&
        !rule.contexts.includes("all"))
    )
      throw new AppError(
        "UNSUPPORTED_ADAPTATION",
        "이 레시피에 적용할 근거가 부족한 대체예요.",
      );
    if (rule.to.some((t) => ids.includes(t.id)))
      throw new AppError(
        "UNSUPPORTED_ADAPTATION",
        "연쇄 대체 대신 원래 재료별로 비교해 주세요.",
      );
    if (rule.kind === "ingredient") {
      const item = result.ingredients.find((i) => i.id === rule.fromId);
      if (!item)
        throw new AppError("UNSUPPORTED_ADAPTATION", "원본에 없는 재료예요.");
      result.ingredients = result.ingredients.filter(
        (i) => i.id !== rule.fromId,
      );
      for (const target of rule.to) {
        let base = item.quantity;
        if (target.unit && target.unit !== item.unit)
          base = convertDifferentCups(
            base,
            item.unit,
            target.unit,
            catalog.ingredients.find((i) => i.id === item.id),
            recipe.cupMl ?? 240,
          );
        const quantity = rounded(D(base).mul(target.ratio), 6);
        const existing = result.ingredients.find(
          (i) => i.id === target.id && i.unit === (target.unit ?? item.unit),
        );
        if (existing)
          existing.quantity = rounded(D(existing.quantity).add(quantity), 6);
        else
          result.ingredients.push({
            id: target.id,
            quantity,
            unit: target.unit ?? item.unit,
            role: item.role,
          });
      }
    } else {
      if (!result.equipmentIds.includes(rule.fromId))
        throw new AppError("UNSUPPORTED_ADAPTATION", "원본에 없는 도구예요.");
      result.equipmentIds = result.equipmentIds
        .filter((id) => id !== rule.fromId)
        .concat(rule.to.map((t) => t.id));
    }
    changes.push(rule.changes);
    result.steps.push({
      text: `대체 시 조정: ${rule.changes}`,
      advanced: `${rule.conditions} / ${rule.limits}`,
    });
  }
  result.ingredients = result.ingredients.map((i) => ({
    ...i,
    quantity: rounded(D(i.quantity).mul(scale), 6),
  }));
  result.servings *= scale;
  result.yieldCount *= scale;
  return {
    recipe: result,
    changes,
    status: rules.length ? "조건부 대체 · 실제 제조 미검증" : "분량 조정",
    warnings: rules.map((r) => r.limits),
  };
}
// 먼저 금지 조건을 거른 뒤 점수를 매깁니다. 높은 점수가 불가능한 배합을 허용하지 않습니다.
export function matchRecipes(input: MatchInput, catalog: Catalog) {
  if (input.mustUseIds.some((id) => input.excludedIds.includes(id)))
    throw new AppError(
      "CONSTRAINT_CONFLICT",
      "반드시 쓸 재료와 제외 재료가 겹쳐요.",
    );
  const rank: Record<string, number> = {
    READY: 0,
    ADAPTABLE: 1,
    PREPARE: 2,
    UNKNOWN: 3,
  };
  return catalog.recipes
    .flatMap((recipe) => {
      const hasFormula =
        recipe.evidence === "FORMULA_REVIEWED" || recipe.tested;
      if (!hasFormula && !input.filters?.exploratory) return [];
      const required = recipe.ingredients.filter((i) => !i.optional);
      const needed = new Set(required.map((i) => i.id));
      if (
        !required.length ||
        input.excludedIds.some((id) => needed.has(id)) ||
        input.mustUseIds.some((id) => !needed.has(id))
      )
        return [];
      if (
        input.filters?.maxTotalMinutes &&
        recipe.totalMin > input.filters.maxTotalMinutes
      )
        return [];
      if (
        input.filters?.maxDifficulty &&
        recipe.difficulty > input.filters.maxDifficulty
      )
        return [];
      if (
        input.filters?.appliance &&
        input.filters.appliance !== recipe.appliance
      )
        return [];
      if (
        input.ingredientMode === "STRICT" &&
        required.some((i) => !input.allowedIds.includes(i.id))
      )
        return [];
      const quantities = required.map((item) => {
        const stock = stockAmount(
          input.pantry,
          item,
          catalog,
          recipe.cupMl ?? 240,
        );
        return {
          ...item,
          stock,
          fulfilled: stock.total >= item.quantity,
          missing: !stock.present,
        };
      });
      const missing = quantities.filter((i) => i.missing);
      const short = quantities.filter((i) => !i.fulfilled && !i.stock.unknown);
      const unknown = quantities.filter((i) => !i.fulfilled && i.stock.unknown);
      const tools = recipe.equipmentIds.filter(
        (id) => !input.equipment.includes(id),
      );
      const possibleRules = catalog.substitutions.filter(
        (r) =>
          r.evidence === "reviewed" &&
          (r.contexts.includes(recipe.category) ||
            r.contexts.includes("all")) &&
          r.to.every((t) =>
            r.kind === "ingredient"
              ? input.allowedIds.includes(t.id)
              : input.equipment.includes(t.id),
          ),
      );
      const swaps = [
        ...missing.map((i) =>
          possibleRules.find(
            (r) => r.kind === "ingredient" && r.fromId === i.id,
          ),
        ),
        ...tools.map((id) =>
          possibleRules.find((r) => r.kind === "equipment" && r.fromId === id),
        ),
      ];
      let allSwappable = !!(
        swaps.length > 0 &&
        swaps.length <= 2 &&
        swaps.every(Boolean) &&
        input.filters?.allowSubstitutions &&
        input.ingredientMode !== "STRICT"
      );
      // 대체품을 갖고 있다는 체크만으로는 부족합니다. 대체 후 실제 필요량까지 다시 판정합니다.
      if (allSwappable) {
        try {
          const candidate = adapt(recipe, swaps as Rule[], catalog).recipe;
          allSwappable =
            candidate.ingredients
              .filter((i) => !i.optional)
              .every(
                (i) =>
                  stockAmount(input.pantry, i, catalog, recipe.cupMl ?? 240)
                    .total >= i.quantity,
              ) &&
            candidate.equipmentIds.every((id) => input.equipment.includes(id));
        } catch {
          allSwappable = false;
        }
      }
      const reasons: string[] = [];
      if (missing.length) reasons.push(`없는 재료 ${missing.length}개`);
      if (short.length) reasons.push(`양이 부족한 재료 ${short.length}개`);
      if (unknown.length) reasons.push(`양 미확인 ${unknown.length}개`);
      if (tools.length) reasons.push(`준비할 도구 ${tools.length}개`);
      const reviewed = recipe.evidence === "FORMULA_REVIEWED" || recipe.tested;
      let state =
        !missing.length && !short.length && !unknown.length && !tools.length
          ? "READY"
          : allSwappable
            ? "ADAPTABLE"
            : unknown.length &&
                !missing.length &&
                !short.length &&
                !tools.length
              ? "UNKNOWN"
              : "PREPARE";
      if (!reviewed) {
        state = "UNKNOWN";
        reasons.push("응용 배합 · 제조 전 검토 필요");
      }
      const score = rounded(
        50 * (1 - missing.length / required.length) +
          (20 * quantities.filter((i) => i.fulfilled).length) /
            required.length +
          15 *
            (recipe.equipmentIds.length
              ? 1 - tools.length / recipe.equipmentIds.length
              : 1) +
          10 +
          5,
      );
      const ratios = quantities.map((i) =>
        i.fulfilled || !i.stock.unknown ? i.stock.total / i.quantity : null,
      );
      const maxScale = ratios.some((x) => x === null)
        ? null
        : Math.min(...(ratios as number[]));
      return [
        {
          recipe,
          state,
          score,
          reasons: reasons.length ? reasons : ["재료와 수량·도구가 맞아요"],
          missing: missing.map((i) => i.id),
          short: short.map((i) => i.id),
          tools,
          maxScale,
          ruleIds: allSwappable ? swaps.map((r) => r!.id) : [],
        },
      ];
    })
    .sort(
      (a, b) =>
        rank[a.state] - rank[b.state] ||
        b.score - a.score ||
        a.recipe.id.localeCompare(b.recipe.id),
    );
}
