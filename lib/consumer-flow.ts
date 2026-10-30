import type { Catalog, Entry, Pantry, Recipe } from "./types";

// 한 재료의 여러 봉지와 서로 다른 단위를 그대로 보존해 stockAmount가 합산하게 합니다.
export function recommendationPantry(ids: string[], pantry: Pantry[], catalog: Catalog): Pantry[] {
  return [...new Set(ids)].flatMap(id => {
    const lots = pantry.filter(p => p.ingredientId === id);
    return lots.length ? lots.map(p => ({ ...p })) : [{ ingredientId: id, quantity: null, unit: catalog.ingredients.find(i => i.id === id)?.unit ?? "g" }];
  });
}
export function exclusionIds(selected: string[], allergenIds: string[], catalog: Catalog) {
  return [...new Set([...selected, ...catalog.ingredients.filter(i => i.allergens.some(a => allergenIds.includes(a))).map(i => i.id)])];
}
export function bakeLink(recipeId: string, options: { versionId?: string | null; scale?: number; run?: string | null } = {}) {
  const params = new URLSearchParams();
  if (options.versionId) params.set("version", options.versionId);
  else params.set("scale", String(options.scale ?? 1));
  if (options.run) params.set("run", options.run);
  return `/recipes/${encodeURIComponent(recipeId)}/bake?${params}`;
}
export function savedCup(settings: Entry[]) {
  const record = settings.find(s => s.kind === "cup-profile");
  return record && Number.isFinite(record.ml) && record.ml >= 10 && record.ml <= 2000 ? { name: String(record.name ?? "내 컵"), ml: Number(record.ml) } : null;
}
export function preparationFingerprint(recipe: Recipe) {
  return JSON.stringify([recipe.id, recipe.ingredients.map(i => [i.id, i.quantity, i.unit])]);
}
export function preparationChecks(settings: Entry[], recipe: Recipe) {
  const record = settings.find(s => s.kind === "preparation" && s.fingerprint === preparationFingerprint(recipe));
  return Array.isArray(record?.checks) ? record.checks.filter((id: string) => recipe.ingredients.some(i => i.id === id)) as string[] : [];
}
export function validateCup(name: string, ml: number, confirmed: boolean) {
  if (!name.trim() || name.trim().length > 40) throw new Error("컵 이름은 1~40자로 입력하세요.");
  if (!Number.isFinite(ml) || ml < 10 || ml > 2000) throw new Error("확인한 용량을 10~2,000ml 사이로 입력하세요.");
  if (!confirmed) throw new Error("컵의 용량을 직접 확인한 뒤 체크해 주세요.");
  return { kind: "cup-profile", name: name.trim(), ml };
}
