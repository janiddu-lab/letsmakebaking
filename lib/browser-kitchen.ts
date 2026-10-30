import type { Catalog, Entry, Recipe } from "./types";
import { adapt, convertDifferentCups } from "./domain";
import { summarizeTwins, autopsy } from "./science";

// 공개 서버에 개인 기록을 보내지 않습니다. 방문자별 주방은 브라우저 IndexedDB에 저장합니다.
export const kitchenStores = ["pantry", "equipment", "prices", "saved", "collections", "versions", "sessions", "journal", "attempts", "contributions", "settings", "previews", "consumptions"] as const;
type User = Record<string, Entry[]>;
export type KitchenData = { schemaVersion: 2; profiles: Entry[]; users: Record<string, User>; photos: Record<string, { profileId: string; url: string }> };
export function emptyUser(): User { return Object.fromEntries(kitchenStores.map(k => [k, []])); }
export function newKitchen(): KitchenData {
  return { schemaVersion: 2, profiles: [{ id: "local-default", nickname: "나의 주방" }], users: { "local-default": emptyUser() }, photos: {} };
}
type StoreTransaction = <T>(change: (data: KitchenData) => T) => Promise<T>;
let database: Promise<IDBDatabase> | undefined;
const transaction: StoreTransaction = async change => {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("baking-personal-kitchen", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("kitchen");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(new Error("이 브라우저에서 저장소를 열 수 없어요. 시크릿 모드나 저장 공간 설정을 확인해 주세요.")); };
  });
  const db = await database;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kitchen", "readwrite"), store = tx.objectStore("kitchen");
    let result: any;
    const read = store.get("data");
    read.onsuccess = () => {
      try {
        const data: KitchenData = read.result ?? newKitchen();
        result = change(data);
        store.put(data, "data");
      } catch (error) { tx.abort(); reject(error); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(new Error("저장하지 못했어요. 저장 공간을 확인하고 기록을 백업해 주세요."));
    tx.onabort = () => reject(new Error("저장을 취소했어요. 기록을 확인하고 다시 시도해 주세요."));
  });
};

// 검증·중복 처리·재고 차감을 화면마다 복제하지 않고 같은 저장 경로에서 처리합니다.
export class BrowserKitchen {
  catalog?: Catalog;
  activeProfile = "local-default";
  photoUrls: Record<string, string> = {};
  constructor(private store: StoreTransaction = transaction) {}
  async hydrate(boot: any, requested: string) {
    this.catalog = boot.catalog;
    return this.store(data => {
      const profile = data.profiles.find(p => p.id === requested) ?? data.profiles[0];
      this.activeProfile = profile.id;
      this.photoUrls = Object.fromEntries(Object.entries(data.photos).filter(([, p]) => p.profileId === profile.id).map(([id, p]) => [id, p.url]));
      return { ...boot, profiles: data.profiles, profile, user: data.users[profile.id] ?? emptyUser() };
    });
  }
  photo(id: string) { return this.photoUrls[id] ?? ""; }
  async request(route: string, body: any, verb: string): Promise<{ handled: boolean; data?: any }> {
    const url = new URL(route, "https://browser.invalid/"), key = url.pathname.slice(1);
    const parts = key.split("/"), profileId = url.searchParams.get("profileId") ?? this.activeProfile;
    const supported = parts[0] === "state" || parts[0] === "profiles" || ["adaptations/preview", "recipe-versions", "program-results", "export", "browser/import", "inventory-consumptions/preview", "inventory-consumptions/confirm", "features/twins", "features/autopsy", "uploads"].includes(key);
    if (!supported) return { handled: false };
    if (key === "uploads") {
      const file = body instanceof FormData ? body.get("file") : null;
      if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5_000_000) throw new Error("5MB 이하 JPEG·PNG·WebP 사진을 선택하세요.");
      body = { image: await resizePhoto(file) };
    }
    const value = await this.store(data => {
      const user = data.users[profileId];
      if (!user) throw new Error("주방을 찾을 수 없어요. 새로고침해 주세요.");
      const c = this.catalog!;
      const put = (kind: string, value: any) => {
        if (!kitchenStores.includes(kind as any)) throw new Error("지원하지 않는 기록 종류예요.");
        const previous = user[kind].find(r => r.id === value.id);
        const row = { ...previous, ...value, id: value.id ?? crypto.randomUUID(), profileId, version: (previous?.version ?? 0) + 1, createdAt: previous?.createdAt ?? new Date().toISOString() };
        validateRecord(kind, row, c);
        user[kind] = [...user[kind].filter(r => r.id !== row.id), row];
        return row;
      };
      if (parts[0] === "profiles") {
        if (verb === "GET") return data.profiles;
        if (verb === "DELETE") {
          if (data.profiles.length < 2) throw new Error("마지막 주방은 삭제할 수 없어요.");
          data.profiles = data.profiles.filter(p => p.id !== parts[1]);
          delete data.users[parts[1]];
          for (const [id, photo] of Object.entries(data.photos)) if (photo.profileId === parts[1]) delete data.photos[id];
          return { deleted: true };
        }
        const nickname = String(body.nickname ?? "").trim();
        if (!nickname || nickname.length > 30) throw new Error("별명은 1~30자로 입력하세요.");
        const profile = { id: parts[1] ?? crypto.randomUUID(), nickname };
        data.profiles = [...data.profiles.filter(p => p.id !== profile.id), profile];
        data.users[profile.id] ??= emptyUser();
        return profile;
      }
      if (parts[0] === "state") {
        const kind = parts[1], id = parts[2] ?? body?.id;
        if (!kitchenStores.includes(kind as any)) throw new Error("저장할 항목을 확인해 주세요.");
        if (verb === "GET") return id ? user[kind].find(r => r.id === id) : user[kind];
        if (verb === "DELETE") {
          user[kind] = user[kind].filter(r => r.id !== id);
          if (kind === "collections") user.saved = user.saved.map(r => r.collectionId === id ? { ...r, collectionId: null } : r);
          return { deleted: true };
        }
        const duplicate = kind === "saved" ? user.saved.find(r => r.recipeId === body.recipeId) : null;
        return put(kind, { ...body, id: duplicate?.id ?? id });
      }
      if (key === "adaptations/preview") {
        const original = c.recipes.find(r => r.id === body.recipeId);
        if (!original) throw new Error("레시피를 선택하세요.");
        const rules = c.substitutions.filter(r => (body.ruleIds ?? []).includes(r.id));
        if (rules.length !== (body.ruleIds ?? []).length) throw new Error("대체 규칙을 다시 선택하세요.");
        const preview = adapt(original, rules, c, Number(body.scale ?? 1));
        const row = put("previews", { kind: "adaptation", original, preview, expiresAt: Date.now() + 600000 });
        return { ...preview, previewId: row.id };
      }
      if (key === "recipe-versions") {
        const preview = user.previews.find(p => p.id === body.previewId && p.kind === "adaptation");
        if (!preview || preview.expiresAt < Date.now()) throw new Error("변경 미리보기를 다시 만들어 주세요.");
        return put("versions", { recipeId: preview.original.id, label: body.label ?? "나의 수정본", ...preview.preview });
      }
      if (key === "program-results") return user.attempts.map(a => ({ ...a, nickname: data.profiles.find(p => p.id === profileId)?.nickname }));
      if (key === "features/autopsy") return put("settings", { kind: "autopsy", symptom: body.symptom, facts: body.facts, result: autopsy(body.symptom, body.facts) });
      if (key === "uploads") {
        const id = crypto.randomUUID();
        data.photos[id] = { profileId, url: body.image };
        this.photoUrls[id] = body.image;
        return { id };
      }
      if (key === "export") return { schemaVersion: 2, profile: data.profiles.find(p => p.id === profileId), data: user, photos: Object.fromEntries(Object.entries(data.photos).filter(([, p]) => p.profileId === profileId)) };
      if (key === "browser/import") {
        validateBackup(body, c);
        // 백업은 별도 주방으로 복원하여 기존 기록을 덮어쓰거나 참조 ID를 깨뜨리지 않습니다.
        const id = crypto.randomUUID();
        const nickname = `${String(body.profile?.nickname ?? "가져온 주방").slice(0, 20)} (복원)`;
        data.profiles.push({ id, nickname });
        const restored = emptyUser();
        for (const kind of kitchenStores) restored[kind] = (body.data[kind] ?? []).map((r: Entry) => ({ ...r, profileId: id }));
        data.users[id] = restored;
        // 사진 ID도 바꿔 다른 주방의 기존 사진과 충돌하지 않도록 합니다.
        const imageMap = new Map<string, string>();
        for (const [photoId, photo] of Object.entries(body.photos ?? {}) as [string, any][]) {
          const nextId = crypto.randomUUID(); imageMap.set(photoId, nextId);
          data.photos[nextId] = { profileId: id, url: photo.url };
        }
        restored.journal = restored.journal.map(r => ({ ...r, photos: (r.photos ?? []).map((p: string) => imageMap.get(p)).filter(Boolean) }));
        restored.settings = restored.settings.map(r => ({ ...r, photos: (r.photos ?? []).map((p: string) => imageMap.get(p)).filter(Boolean) }));
        return { id, nickname };
      }
      if (key === "features/twins") {
        if (verb === "GET") return summarizeTwins(user.settings, url.searchParams.get("protocol") ?? "");
        for (const field of ["aDiameter", "bDiameter", "aThickness", "bThickness"]) if (!(Number(body[field]) > 0) || Number(body[field]) > 1000) throw new Error("지름과 두께를 0보다 큰 실제 측정값으로 입력하세요.");
        if (!String(body.aValue ?? "").trim() || !String(body.bValue ?? "").trim()) throw new Error("A와 B의 실험 조건을 모두 입력하세요.");
        if (String(body.aValue).trim() === String(body.bValue).trim()) throw new Error("A와 B의 조건을 다르게 입력하세요.");
        const recipe = c.recipes.find(r => r.id === body.recipeId);
        if (!recipe) throw new Error("레시피를 선택하세요.");
        const protocolKey = JSON.stringify([recipe.id, recipe.ingredients, body.variable, body.aValue.trim(), body.bValue.trim()]);
        const saved = put("settings", { ...body, kind: "twin-experiment", protocolKey });
        return { saved, summary: summarizeTwins(user.settings, protocolKey) };
      }
      if (key.startsWith("inventory-consumptions/")) {
        const log = user.journal.find(l => l.id === body.bakeLogId);
        if (!log?.recipe) throw new Error("완성한 레시피가 연결된 기록이 필요해요.");
        if (user.consumptions.some(r => r.bakeLogId === log.id)) throw new Error("이 기록의 재고는 이미 차감했어요.");
        if (key.endsWith("preview")) {
          const changes = (log.recipe as Recipe).ingredients.filter(i => !i.optional).map(item => {
            let missing = item.quantity;
            const lots = user.pantry.filter(l => l.ingredientId === item.id && l.quantity !== null).map(lot => {
              try {
                const ing = c.ingredients.find(i => i.id === item.id);
                const available = convertDifferentCups(lot.quantity, lot.unit, item.unit, ing, lot.cupMl ?? 240, log.recipe.cupMl ?? 240);
                const used = Math.min(missing, available); missing -= used;
                return { id: lot.id, expectedVersion: lot.version, quantity: convertDifferentCups(available - used, item.unit, lot.unit, ing, log.recipe.cupMl ?? 240, lot.cupMl ?? 240) };
              } catch { return { id: lot.id, expectedVersion: lot.version, quantity: lot.quantity }; }
            });
            return { ingredientId: item.id, missing, lots };
          });
          const p = put("previews", { kind: "consumption", bakeLogId: log.id, changes, expiresAt: Date.now() + 600000 });
          return { previewToken: p.id, changes };
        }
        const preview = user.previews.find(p => p.id === body.previewToken && p.kind === "consumption" && p.bakeLogId === log.id);
        if (!preview || preview.expiresAt < Date.now()) throw new Error("차감 미리보기를 다시 만들어 주세요.");
        const lots = preview.changes.flatMap((ch: any) => ch.lots);
        if (lots.some((lot: any) => user.pantry.find(p => p.id === lot.id)?.version !== lot.expectedVersion)) throw new Error("재고가 바뀌었어요. 차감 미리보기를 다시 확인하세요.");
        for (const lot of lots) put("pantry", { ...user.pantry.find(p => p.id === lot.id), quantity: lot.quantity });
        put("consumptions", { bakeLogId: log.id });
        return { consumed: true };
      }
    });
    return { handled: true, data: value };
  }
}
function validateRecord(kind: string, row: any, c: Catalog) {
  if (kind === "pantry" || kind === "prices") {
    if (!c.ingredients.some(i => i.id === row.ingredientId)) throw new Error("재료를 목록에서 선택하세요.");
    const units = kind === "pantry" ? ["g", "kg", "ml", "L", "ea", "tsp", "tbsp", "cup"] : ["g", "kg", "ml", "L", "ea"];
    if (!units.includes(kind === "pantry" ? row.unit : row.packageUnit)) throw new Error("지원되는 단위를 선택하세요.");
    for (const key of kind === "pantry" ? ["quantity"] : ["packageQuantity", "packagePrice"]) if (row[key] !== null && (!Number.isFinite(Number(row[key])) || Number(row[key]) < 0)) throw new Error("수량과 가격은 0 이상의 숫자로 입력하세요.");
    if (kind === "prices" && !(Number(row.packageQuantity) > 0)) throw new Error("포장 용량은 0보다 커야 해요.");
    if (kind === "pantry" && row.unit === "cup" && !(Number(row.cupMl) > 0)) throw new Error("컵의 실제 용량을 ml로 입력하세요.");
  }
  if (kind === "equipment" && !c.equipment.some(e => e.id === row.equipmentId)) throw new Error("도구를 목록에서 선택하세요.");
  if (kind === "saved" && !c.recipes.some(r => r.id === row.recipeId)) throw new Error("레시피를 찾을 수 없어요.");
  if (kind === "journal" && !String(row.title ?? "").trim()) throw new Error("기록 제목을 입력하세요.");
}
export function validateBackup(body: any, c: Catalog) {
  if (body?.schemaVersion !== 2 || !body.data || typeof body.data !== "object") throw new Error("이 웹에서 내려받은 브라우저 백업 JSON을 선택하세요.");
  for (const [kind, rows] of Object.entries(body.data)) {
    if (!kitchenStores.includes(kind as any) || !Array.isArray(rows) || rows.length > 10000) throw new Error("백업 형식이 올바르지 않아요.");
    for (const row of rows) { if (!row || typeof row.id !== "string") throw new Error("백업 기록 ID를 확인하세요."); validateRecord(kind, row, c); }
  }
  for (const photo of Object.values(body.photos ?? {}) as any[]) if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo?.url ?? "")) throw new Error("백업에 지원하지 않는 사진이 있어요.");
}
async function resizePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("사진을 처리할 수 없어요.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", .8);
  } finally { bitmap.close(); }
}
export const browserKitchen = new BrowserKitchen();
