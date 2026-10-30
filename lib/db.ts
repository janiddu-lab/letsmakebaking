import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Catalog, Entry } from "./types";
import { AppError } from "./types";

// Node 24에 내장된 SQLite를 사용해 별도 DB 서버나 네이티브 설치 없이 실행합니다.
const tables = [
  "profiles",
  "pantry",
  "equipment",
  "prices",
  "saved",
  "collections",
  "versions",
  "sessions",
  "journal",
  "attempts",
  "contributions",
  "prompts",
  "trendSources",
  "trendItems",
  "runs",
  "messages",
  "previews",
  "consumptions",
  "content",
  "usage",
  "uploads",
  "settings",
] as const;
export type Store = (typeof tables)[number];
export const dataDirectory = () =>
  process.env.BAKING_DATA_DIR ?? path.join(process.cwd(), "data");
const globalDb = globalThis as unknown as { bakingDb?: DatabaseSync };
export function db() {
  if (globalDb.bakingDb) return globalDb.bakingDb;
  const dir = dataDirectory();
  if (process.env.BAKING_PUBLIC_DEMO === "true" && path.resolve(/* turbopackIgnore: true */ dir) === path.resolve(process.cwd(), "data"))
    throw new AppError("DEMO_DATA_DIRECTORY", "공유 데모에는 개인 기록 폴더와 다른 BAKING_DATA_DIR를 설정하세요.", 503);
  mkdirSync(dir, { recursive: true });
  const sql = new DatabaseSync(path.join(dir, "baking.sqlite"));
  sql.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  // 복합 콘텐츠는 JSON에, 검색과 소유권에 필요한 값은 인덱스 열에 저장합니다.
  for (const name of tables)
    sql.exec(
      `CREATE TABLE IF NOT EXISTS "${name}" (id TEXT PRIMARY KEY, profileId TEXT, data TEXT NOT NULL CHECK(json_valid(data)), version INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL); CREATE INDEX IF NOT EXISTS "idx_${name}_profile" ON "${name}"(profileId);`,
    );
  globalDb.bakingDb = sql;
  if (!all("profiles").length)
    put("profiles", {
      id: "local-default",
      nickname: "나의 주방",
      explanationLevel: "beginner",
    });
  if (!all("prompts").length) {
    const file = path.join(process.cwd(), "prompts/baking-coach.md");
    put("prompts", {
      id: randomUUID(),
      name: "기본 베이킹 코치",
      body: existsSync(file)
        ? readFileSync(file, "utf8")
        : "한국어로 베이킹을 설명하세요.",
      active: true,
    });
  }
  return sql;
}
function rowToEntry(row: any): Entry {
  return {
    ...JSON.parse(row.data),
    id: row.id,
    profileId: row.profileId,
    version: row.version,
    createdAt: row.createdAt,
  };
}
export function all(store: Store, profileId?: string): Entry[] {
  return (
    profileId === undefined
      ? db().prepare(`SELECT * FROM "${store}" ORDER BY createdAt`).all()
      : db()
          .prepare(
            `SELECT * FROM "${store}" WHERE profileId=? ORDER BY createdAt`,
          )
          .all(profileId)
  ).map(rowToEntry);
}
export function get(
  store: Store,
  id: string,
  profileId?: string,
): Entry | undefined {
  const row = db().prepare(`SELECT * FROM "${store}" WHERE id=?`).get(id);
  if (!row) return undefined;
  const item = rowToEntry(row);
  if (profileId !== undefined && item.profileId !== profileId)
    throw new AppError("NOT_FOUND", "자료를 찾을 수 없어요.", 404);
  return item;
}
export function put(
  store: Store,
  data: Record<string, any>,
  profileId?: string,
): Entry {
  const id = data.id || randomUUID();
  const previous = get(store, id);
  if (previous && profileId !== undefined && previous.profileId !== profileId)
    throw new AppError("NOT_FOUND", "자료를 찾을 수 없어요.", 404);
  if (
    previous &&
    data.expectedVersion !== undefined &&
    previous.version !== data.expectedVersion
  )
    throw new AppError(
      "STALE_VERSION",
      "다른 변경이 있어요. 다시 확인해 주세요.",
      409,
    );
  const now = new Date().toISOString();
  const payload: Record<string, any> = { ...data, id };
  delete payload.expectedVersion;
  delete payload.version;
  delete payload.profileId;
  delete payload.createdAt;
  db()
    .prepare(
      `INSERT INTO "${store}" (id,profileId,data,version,createdAt,updatedAt) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=version+1,updatedAt=excluded.updatedAt`,
    )
    .run(
      id,
      previous?.profileId ?? profileId ?? null,
      JSON.stringify(payload),
      1,
      previous?.createdAt ?? now,
      now,
    );
  return get(store, id)!;
}
export function remove(store: Store, id: string, profileId?: string) {
  get(store, id, profileId);
  db().prepare(`DELETE FROM "${store}" WHERE id=?`).run(id);
}
// 재고 차감이나 백업 병합 중 오류가 나면 그 묶음 전체를 되돌립니다.
export function transaction<T>(fn: () => T): T {
  const sql = db();
  sql.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    sql.exec("COMMIT");
    return result;
  } catch (e) {
    sql.exec("ROLLBACK");
    throw e;
  }
}
// 읽기 전용 원본 자료 위에 검토 후 공개한 수정 이력만 덧씌웁니다.
export function catalog(): Catalog {
  const file = path.join(process.cwd(), "content/catalog.json");
  if (!existsSync(file))
    throw new AppError(
      "CONTENT_NOT_READY",
      "콘텐츠 자료를 준비하고 있어요.",
      503,
    );
  const base = JSON.parse(readFileSync(file, "utf8")) as Catalog;
  for (const edit of all("content")) {
    const key = edit.kind as keyof Catalog;
    const list = base[key] as any[];
    if (!Array.isArray(list)) continue;
    const at = list.findIndex((v) => v.id === edit.contentId);
    if (edit.status === "PUBLISHED") {
      if (at >= 0) list[at] = edit.payload;
      else list.push(edit.payload);
    }
  }
  return base;
}
export function profileData(profileId: string) {
  if (!get("profiles", profileId))
    throw new AppError("NOT_FOUND", "프로필을 선택해 주세요.", 404);
  return Object.fromEntries(
    [
      "pantry",
      "equipment",
      "prices",
      "saved",
      "collections",
      "versions",
      "sessions",
      "journal",
      "attempts",
      "contributions",
      "settings",
    ].map((name) => [name, all(name as Store, profileId)]),
  );
}
export function backup(profileId: string) {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    profile: get("profiles", profileId),
    data: profileData(profileId),
    notice:
      "업로드 이미지는 별도로 보관하세요. API 키와 서버 설정은 포함되지 않습니다.",
  };
}
