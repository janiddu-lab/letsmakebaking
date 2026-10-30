import { all, put, catalog } from "../lib/db";
// 체험용 값은 실제 주방과 구분된 별도 프로필에만 넣습니다. 기존 입력은 덮어쓰지 않습니다.
const c = catalog();
const profile =
  all("profiles").find((p) => p.nickname === "체험용 주방") ??
  put("profiles", {
    nickname: "체험용 주방",
    explanationLevel: "beginner",
    isDemo: true,
  });
const recipes = [
  c.recipes.find(
    (r) => r.category === "cookie" && r.evidence === "FORMULA_REVIEWED",
  ),
  c.recipes.find(
    (r) => r.category === "bread" && r.evidence === "FORMULA_REVIEWED",
  ),
].filter(Boolean);
for (const recipe of recipes) {
  for (const i of recipe!.ingredients) {
    if (!all("pantry", profile.id).some((p) => p.ingredientId === i.id))
      put(
        "pantry",
        {
          ingredientId: i.id,
          quantity: i.quantity * 3,
          unit: i.unit,
          cupMl: recipe!.cupMl ?? 240,
          isSample: true,
        },
        profile.id,
      );
    if (
      ["g", "ml", "ea"].includes(i.unit) &&
      !all("prices", profile.id).some((p) => p.ingredientId === i.id)
    )
      put(
        "prices",
        {
          ingredientId: i.id,
          packageQuantity: i.unit === "ea" ? 10 : 1000,
          packageUnit: i.unit,
          packagePrice: i.unit === "ea" ? 4000 : 5000,
          currency: "KRW",
          isSample: true,
        },
        profile.id,
      );
  }
  for (const equipmentId of recipe!.equipmentIds)
    if (
      !all("equipment", profile.id).some((e) => e.equipmentId === equipmentId)
    )
      put("equipment", { equipmentId }, profile.id);
}
console.log(
  `체험용 주방 준비 완료. 실제 재료가 아닌 예시입니다. 프로필 ${profile.id}`,
);
