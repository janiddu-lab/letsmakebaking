import { describe, it, expect } from "vitest";
import catalogData from "../content/catalog.json";
import type { Catalog } from "../lib/types";
import { BrowserKitchen, newKitchen, validateBackup, type KitchenData } from "../lib/browser-kitchen";
const catalog = catalogData as Catalog;
// 실제 저장소와 동일하게 커밋 때만 반영하는 메모리 트랜잭션으로 사용자 흐름을 검증합니다.
function fixture() {
  let state = newKitchen();
  const store = async <T>(change: (d: KitchenData) => T) => { const next = structuredClone(state); const result = change(next); state = next; return structuredClone(result); };
  const kitchen = new BrowserKitchen(store);
  const boot = { catalog, health: { publicDemo: true }, user: {}, profiles: [] };
  return { kitchen, store, boot, call: async (route: string, body?: any, method?: string) => (await kitchen.request(route, body, method ?? (body === undefined ? "GET" : "POST"))).data };
}
describe("방문자 브라우저 주방의 실제 사용 흐름", () => {
  it("공백뿐인 쌍둥이 조건과 같은 조건을 다른 실험으로 저장하지 않는다", async () => {
    const f = fixture(); await f.kitchen.hydrate(f.boot, "local-default");
    const input = { recipeId: "shortbread", aValue: " ", bValue: "30분", aDiameter: 60, bDiameter: 55, aThickness: 10, bThickness: 12 };
    await expect(f.call("features/twins", input)).rejects.toThrow("모두 입력");
    await expect(f.call("features/twins", { ...input, aValue: " 30분 " })).rejects.toThrow("다르게");
    expect((await f.call("state/settings"))).toHaveLength(0);
  });
  it("서버 예시 재고를 개인 주방으로 복사하지 않는다", async () => {
    const f = fixture(); const b = await f.kitchen.hydrate({ ...f.boot, user: { pantry: [{ id: "server" }] } }, "local-default");
    expect(b.user.pantry).toEqual([]); expect(b.profile.nickname).toBe("나의 주방");
  });
  it("재료·가격·기록은 새 인스턴스에서도 보존되고 다른 프로필에는 섞이지 않는다", async () => {
    const f = fixture(); await f.kitchen.hydrate(f.boot, "local-default");
    await f.call("state/pantry", { ingredientId: "flour-allpurpose", quantity: 500, unit: "g" });
    await f.call("state/prices", { ingredientId: "flour-allpurpose", packageQuantity: 1000, packageUnit: "g", packagePrice: 3000 });
    await f.call("state/journal", { title: "첫 쿠키", note: "두께를 같게 만들자" });
    const reloaded = await new BrowserKitchen(f.store).hydrate(f.boot, "local-default");
    expect(reloaded.user.pantry[0].quantity).toBe(500); expect(reloaded.user.journal[0].note).toContain("두께");
    const profile = await f.call("profiles", { nickname: "다른 주방" });
    const separate = await f.kitchen.hydrate(f.boot, profile.id); expect(separate.user.pantry).toEqual([]);
  });
  it("하트 중복 저장을 막고 폴더 삭제 시 레시피를 보존한다", async () => {
    const f = fixture(); await f.kitchen.hydrate(f.boot, "local-default");
    const folder = await f.call("state/collections", { name: "주말" });
    await f.call("state/saved", { recipeId: "shortbread", collectionId: folder.id });
    await f.call("state/saved", { recipeId: "shortbread", collectionId: folder.id });
    await f.call(`state/collections/${folder.id}`, undefined, "DELETE");
    const saved = await f.call("state/saved"); expect(saved).toHaveLength(1); expect(saved[0].collectionId).toBeNull();
  });
  it("대체 미리보기와 배합 배수를 수정본에 그대로 저장한다", async () => {
    const f = fixture(); await f.kitchen.hydrate(f.boot, "local-default");
    const preview = await f.call("adaptations/preview", { recipeId: "shortbread", ruleIds: [], scale: 2 });
    const version = await f.call("recipe-versions", { previewId: preview.previewId, label: "두 배" });
    expect(version.recipe.ingredients[0].quantity).toBe(catalog.recipes[0].ingredients[0].quantity * 2);
    await expect(f.call("recipe-versions", { previewId: "missing" })).rejects.toThrow("미리보기");
  });
  it("완성 기록 재고 차감은 중복 실행을 막고 재고 변경 후에는 다시 확인하게 한다", async () => {
    const f = fixture(); await f.kitchen.hydrate(f.boot, "local-default");
    const lot = await f.call("state/pantry", { ingredientId: "flour-allpurpose", quantity: 500, unit: "g" });
    const log = await f.call("state/journal", { title: "완성", recipe: catalog.recipes[0] });
    const first = await f.call("inventory-consumptions/preview", { bakeLogId: log.id });
    await f.call("state/pantry", { ...lot, quantity: 600 });
    await expect(f.call("inventory-consumptions/confirm", { bakeLogId: log.id, previewToken: first.previewToken })).rejects.toThrow("재고가 바뀌었어요");
    const next = await f.call("inventory-consumptions/preview", { bakeLogId: log.id });
    await f.call("inventory-consumptions/confirm", { bakeLogId: log.id, previewToken: next.previewToken });
    expect((await f.call("state/pantry"))[0].quantity).toBe(480);
    await expect(f.call("inventory-consumptions/confirm", { bakeLogId: log.id, previewToken: next.previewToken })).rejects.toThrow("이미 차감");
  });
  it("백업을 별도 주방에 복원하고 원본 주방과 사진을 보존한다", async () => {
    const f = fixture(); await f.kitchen.hydrate(f.boot, "local-default");
    await f.call("state/journal", { title: "보관할 기록", photos: ["pic"] });
    await f.store(data => { data.photos.pic = { profileId: "local-default", url: "data:image/webp;base64,AAAA" }; });
    const backup = await f.call("export"); const restored = await f.call("browser/import", backup);
    const b = await f.kitchen.hydrate(f.boot, restored.id);
    expect(b.user.journal[0].title).toBe("보관할 기록"); expect(b.user.journal[0].photos[0]).not.toBe("pic");
    expect(f.kitchen.photo(b.user.journal[0].photos[0])).toMatch(/^data:image/);
    expect((await f.kitchen.hydrate(f.boot, "local-default")).user.journal).toHaveLength(1);
  });
  it("음수 재고·알 수 없는 재료·위조 사진 백업은 저장하지 않는다", async () => {
    const f = fixture(); await f.kitchen.hydrate(f.boot, "local-default");
    await expect(f.call("state/pantry", { ingredientId: "flour-allpurpose", quantity: -1, unit: "g" })).rejects.toThrow();
    await expect(f.call("state/pantry", { ingredientId: "no-such", quantity: 1, unit: "g" })).rejects.toThrow();
    expect(() => validateBackup({ schemaVersion: 2, data: {}, photos: { bad: { url: "https://tracker.invalid/" } } }, catalog)).toThrow("사진");
    expect(await f.call("state/pantry")).toEqual([]);
  });
  it("운영자 경로와 트렌드 수집은 브라우저 저장으로 우회하지 않는다", async () => {
    const f = fixture(); expect((await f.kitchen.request("features/social/start", {}, "POST")).handled).toBe(false);
    expect((await f.kitchen.request("admin/content", {}, "POST")).handled).toBe(false);
  });
});
