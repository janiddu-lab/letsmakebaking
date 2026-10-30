import { db, catalog, all, put } from "../lib/db";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
// 재실행해도 기존 기록을 지우지 않는 초기화입니다.
db();
const c = catalog();
if (process.env.BAKING_PUBLIC_DEMO === "true") {
  const profileId = "local-default";
  put("profiles", { id: profileId, nickname: "공유용 체험 주방", explanationLevel: "beginner" });
  if (!all("pantry", profileId).length) {
    for (const item of c.recipes[0].ingredients)
      put("pantry", { ingredientId: item.id, quantity: item.quantity * 3, unit: item.unit, cupMl: c.recipes[0].cupMl ?? 200, note: "공유용 예시 재료" }, profileId);
    for (const equipmentId of c.recipes[0].equipmentIds) put("equipment", { equipmentId }, profileId);
  }
  const snapshot = path.join(process.cwd(), "content/public-trends.json");
  if (existsSync(snapshot) && !all("settings").some((row) => row.kind === "social-trend-run")) {
    const data = JSON.parse(readFileSync(snapshot, "utf8"));
    delete data.id; delete data.profileId; delete data.version;
    put("settings", data);
  }
}
console.log(
  `로컬 DB 준비 완료 · 레시피 ${c.recipes.length}개 · 재료 ${c.ingredients.length}개`,
);
