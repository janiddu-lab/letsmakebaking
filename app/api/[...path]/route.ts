import { NextRequest, NextResponse } from "next/server";
import { randomUUID, randomBytes } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import {
  all,
  get,
  put,
  remove,
  catalog,
  profileData,
  backup,
  transaction,
  dataDirectory,
  type Store,
} from "@/lib/db";
import {
  adapt,
  calculateCost,
  convert,
  convertDifferentCups,
  matchRecipes,
  panFactor,
} from "@/lib/domain";
import {
  askAi,
  collectTrends,
  recognizeImage,
  startScheduler,
  trendData,
} from "@/lib/integrations";
import { AppError, type MatchInput, type Recipe } from "@/lib/types";
import { createBackupZip, parseBackupZip } from "@/lib/archive";
import { featureApi } from "@/lib/feature-api";
import { publicDemoAllows, collectionIsConfigured, publicCollectionAuthorized } from "@/lib/public-demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const shared = globalThis as unknown as { bakingCsrf?: string };
shared.bakingCsrf ??= randomBytes(32).toString("hex");
const stores: Store[] = [
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
];
const number = z.coerce.number().finite().nonnegative();
const matchSchema = z.object({
  entryMode: z.enum(["INGREDIENT_FIRST", "RECIPE_FIRST"]),
  ingredientMode: z.enum(["STRICT", "INCLUDE", "PANTRY"]),
  allowedIds: z.array(z.string()).max(200),
  mustUseIds: z.array(z.string()).max(100),
  excludedIds: z.array(z.string()).max(100),
  pantry: z
    .array(
      z.object({
        ingredientId: z.string(),
        quantity: z.union([number, z.null()]),
        unit: z.enum(["g", "kg", "ml", "L", "ea", "tsp", "tbsp", "cup"]),
        cupMl: number.positive().max(2000).optional(),
      }),
    )
    .max(300),
  equipment: z.array(z.string()),
  targetRecipeId: z.string().optional(),
  filters: z
    .object({
      maxTotalMinutes: number.optional(),
      maxDifficulty: number.optional(),
      appliance: z.string().optional(),
      allowSubstitutions: z.boolean().optional(),
      exploratory: z.boolean().optional(),
    })
    .optional(),
});
function answer(data: unknown, status = 200) {
  return NextResponse.json(
    { data, meta: { csrfToken: shared.bakingCsrf } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
function ownedStore(name: string): Store {
  if (!stores.includes(name as Store))
    throw new AppError("NOT_FOUND", "저장 위치를 찾을 수 없어요.", 404);
  return name as Store;
}
function validateRecord(store: Store, b: any) {
  if (store === "pantry") {
    z.object({
      ingredientId: z.string(),
      quantity: z.union([number, z.null()]),
      unit: z.enum(["g", "kg", "ml", "L", "ea", "tsp", "tbsp", "cup"]),
    }).parse(b);
    if (!catalog().ingredients.some((i) => i.id === b.ingredientId))
      throw new AppError(
        "INVALID_INGREDIENT",
        "재료 사전에 등록된 항목을 선택해 주세요.",
      );
  }
  if (
    store === "pantry" &&
    b.unit === "cup" &&
    b.quantity !== null &&
    !(Number(b.cupMl) > 0)
  )
    throw new AppError(
      "INVALID_QUANTITY",
      "컵으로 등록하려면 실제 컵 용량을 입력해 주세요.",
    );
  if (store === "prices")
    z.object({
      ingredientId: z.string(),
      packageQuantity: number.positive(),
      packagePrice: number,
      packageUnit: z.enum(["g", "kg", "ml", "L", "ea"]),
      currency: z.literal("KRW").optional(),
    }).parse(b);
  if (
    store === "equipment" &&
    !catalog().equipment.some((e) => e.id === b.equipmentId)
  )
    throw new AppError("INVALID_EQUIPMENT", "도구 사전에서 선택해 주세요.");
  if (store === "journal")
    z.object({
      title: z.string().min(1).max(120),
      note: z.string().max(8000).optional(),
    }).parse(b);
}
async function handle(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const route = (await context.params).path;
    const key = route.join("/");
    const verb = req.method;
    const publicDemo = process.env.BAKING_PUBLIC_DEMO === "true";
    const hostedOrigin = process.env.BAKING_PUBLIC_ORIGIN ?? process.env.RENDER_EXTERNAL_URL;
    const allowedHosts = new Set(["localhost", "127.0.0.1"]);
    if (publicDemo && hostedOrigin) allowedHosts.add(new URL(hostedOrigin).hostname);
    if (publicDemo && !publicDemoAllows(key, verb)
      && !publicCollectionAuthorized(key, verb, req.headers.get("x-collection-code") ?? ""))
      throw new AppError("DEMO_READ_ONLY", "이 동작은 공유용 웹에서 제한되어 있어요. 수집을 사용하려면 관리자가 발급한 접근 코드를 확인해 주세요.", 403);
    const profileId =
      req.nextUrl.searchParams.get("profileId") ?? "local-default";
    if (!allowedHosts.has(req.nextUrl.hostname))
      throw new AppError(
        "LOCAL_ONLY",
        "로컬 주소에서만 사용할 수 있어요.",
        403,
      );
    // 다른 웹사이트가 로컬 DB를 변경하지 못하도록 Origin과 난수 토큰을 함께 확인합니다.
    if (!["GET", "HEAD"].includes(verb)) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("host");
      // Next 내부 URL은 localhost로 정규화될 수 있어 실제 Host와 브라우저 Origin을 비교합니다.
      if (
        !origin ||
        new URL(origin).host !== host ||
        !allowedHosts.has(new URL(origin).hostname) ||
        req.headers.get("x-csrf-token") !== shared.bakingCsrf
      )
        throw new AppError(
          "CSRF",
          "페이지를 새로고침하고 다시 시도해 주세요.",
          403,
        );
      if (Number(req.headers.get("content-length") ?? 0) > 25_000_000)
        throw new AppError("UPLOAD_INVALID", "요청이 너무 커요.", 413);
    }
    let body: any = {};
    if (
      !["GET", "DELETE", "HEAD"].includes(verb) &&
      !key.startsWith("uploads") &&
      key !== "import/archive-preview" &&
      key !== "features/models/import"
    ) {
      const raw = await req.text();
      if (raw.length > 8_000_000)
        throw new AppError("UPLOAD_INVALID", "요청이 너무 커요.", 413);
      body = raw ? JSON.parse(raw) : {};
    }
    if (key === "health")
      return answer({
        database: "connected",
        ai:
          process.env.AI_API_KEY && process.env.AI_MODEL
            ? "configured"
            : "not-configured",
        model: process.env.AI_MODEL ?? null,
        localOnly: !publicDemo,
        publicDemo,
      });
    if (key === "bootstrap") {
      startScheduler();
      const activeId = get("profiles", profileId)
        ? profileId
        : all("profiles")[0].id;
      return answer({
        catalog: catalog(),
        profiles: all("profiles"),
        profile: get("profiles", activeId),
        user: profileData(activeId),
        health: {
          ai: !!(process.env.AI_API_KEY && process.env.AI_MODEL),
          model: process.env.AI_MODEL ?? null,
          publicDemo,
          publicCollection: publicDemo && collectionIsConfigured(),
        },
        trends: trendData(),
        assets: {
          ...JSON.parse(
            readFileSync(
              path.join(process.cwd(), "public/assets/manifest.json"),
              "utf8",
            ),
          ),
          home: (() => {
            const config = JSON.parse(
              readFileSync(
                path.join(process.cwd(), "content/models.json"),
                "utf8",
              ),
            );
            return typeof config.home === "string" &&
              config.home.startsWith("/assets/user-models/") &&
              !config.home.includes("..")
              ? config.home
              : null;
          })(),
        },
      });
    }
    if (route[0] === "profiles") {
      if (verb === "GET") return answer(all("profiles"));
      if (verb === "POST" || verb === "PATCH") {
        z.object({ nickname: z.string().trim().min(1).max(30) }).parse(body);
        return answer(
          put("profiles", { ...body, id: route[1] ?? randomUUID() }),
        );
      }
      if (verb === "DELETE") {
        if (all("profiles").length === 1)
          throw new AppError(
            "LAST_PROFILE",
            "마지막 프로필은 삭제할 수 없어요.",
          );
        transaction(() => {
          for (const s of stores)
            for (const row of all(s, route[1])) remove(s, row.id, route[1]);
          remove("profiles", route[1]);
        });
        return answer({ deleted: true });
      }
    }
    if (!get("profiles", profileId))
      throw new AppError("NOT_FOUND", "로컬 프로필이 없어요.", 404);
    const featureResponse = await featureApi(req, key, body, profileId, answer);
    if (featureResponse) return featureResponse;
    if (route[0] === "recipes")
      return answer(
        route[1]
          ? (catalog().recipes.find((r) => r.id === route[1]) ?? null)
          : catalog().recipes.filter(
              (r) =>
                !req.nextUrl.searchParams.get("q") ||
                (r.title + r.tags.join(" ")).includes(
                  req.nextUrl.searchParams.get("q")!,
                ),
            ),
      );
    if (key === "matches") {
      const input = matchSchema.parse(body) as MatchInput;
      const results = matchRecipes(input, catalog());
      const target = results.find((r) => r.recipe.id === input.targetRecipeId);
      return answer({
        results,
        target: target ?? null,
        entryMode: input.entryMode,
      });
    }
    if (key === "calculations") {
      const c = catalog();
      const recipe = (body.recipe ??
        c.recipes.find((r) => r.id === body.recipeId)) as Recipe | undefined;
      if (body.kind === "unit" || body.kind === "egg")
        return answer({
          value: convert(
            body.amount,
            body.from,
            body.to,
            c.ingredients.find((i) => i.id === body.ingredientId),
            body.cupMl ?? 240,
          ),
          note: "재료 사전의 환산 기준에 따른 참고값이에요.",
        });
      if (body.kind === "pan")
        return answer({
          factor: panFactor(body.original, body.next),
          note: "같은 반죽 두께 기준 배합량만 조정해요. 시간과 온도는 자동 배수 적용하지 않아요.",
        });
      if (!recipe) throw new AppError("NOT_FOUND", "레시피가 없어요.", 404);
      if (body.kind === "scale")
        return answer(adapt(recipe, [], c, Number(body.scale ?? 1)));
      return answer(
        calculateCost(
          recipe,
          Number(body.scale ?? 1),
          all("prices", profileId),
          all("pantry", profileId).map((p) => ({
            ingredientId: p.ingredientId,
            quantity: p.quantity,
            unit: p.unit,
          })),
          c,
          Number(body.extras ?? 0),
        ),
      );
    }
    if (key === "adaptations/preview") {
      const c = catalog();
      const original = c.recipes.find((r) => r.id === body.recipeId);
      if (!original)
        throw new AppError("NOT_FOUND", "레시피를 찾을 수 없어요.", 404);
      const rules = c.substitutions.filter((r) =>
        (body.ruleIds ?? []).includes(r.id),
      );
      if (rules.length !== (body.ruleIds ?? []).length)
        throw new AppError(
          "UNSUPPORTED_ADAPTATION",
          "대체 규칙을 확인해 주세요.",
        );
      const preview = adapt(original, rules, c, Number(body.scale ?? 1));
      const row = put(
        "previews",
        {
          kind: "adaptation",
          original,
          preview,
          expiresAt: Date.now() + 600000,
        },
        profileId,
      );
      return answer({ ...preview, previewId: row.id });
    }
    if (key === "recipe-versions" && verb === "POST") {
      const preview = get("previews", body.previewId, profileId);
      if (!preview || preview.expiresAt < Date.now())
        throw new AppError("STALE_VERSION", "미리보기를 다시 생성해 주세요.");
      return answer(
        put(
          "versions",
          {
            recipeId: preview.original.id,
            label: body.label ?? "나의 수정본",
            ...preview.preview,
            prompted: false,
          },
          profileId,
        ),
      );
    }
    if (route[0] === "recipe-versions" && route[2] === "diff") {
      const version = get("versions", route[1], profileId);
      return answer(
        version
          ? {
              original: catalog().recipes.find(
                (r) => r.id === version.recipeId,
              ),
              modified: version.recipe,
              changes: version.changes,
            }
          : null,
      );
    }
    if (route[0] === "articles")
      return answer(
        route[1]
          ? catalog().articles.find((a) => a.id === route[1])
          : catalog().articles,
      );
    if (key === "challenges") return answer(catalog().challenges);
    if (key === "program-results")
      return answer(
        all("attempts").map((a) => ({
          id: a.id,
          title: a.title,
          prediction: a.prediction,
          reflection: a.reflection,
          nickname: get("profiles", a.profileId!)?.nickname ?? "이전 참가자",
        })),
      );
    if (key === "trends") return answer(trendData());
    if (key === "admin/trend-runs")
      return answer(await collectTrends(body.sourceIds));
    if (route[0] === "admin" && route[1] === "trend-runs")
      return answer(get("runs", route[2]) ?? null);
    if (key === "admin/trend-sources" && verb === "GET")
      return answer(all("trendSources"));
    if (route[0] === "admin" && route[1] === "trend-sources") {
      const merged = {
        ...(route[2] ? get("trendSources", route[2]) : {}),
        ...body,
      };
      const url = new URL(merged.url);
      if (
        url.protocol !== "https:" ||
        url.port ||
        url.username ||
        url.password ||
        !merged.termsChecked
      )
        throw new AppError(
          "SOURCE_INVALID",
          "공개 HTTPS RSS 주소와 이용 조건 확인이 필요해요.",
        );
      return answer(
        put("trendSources", {
          ...merged,
          id: route[2] ?? randomUUID(),
          name: String(merged.name).slice(0, 100),
          url: url.href,
          termsCheckedAt: new Date().toISOString(),
        }),
      );
    }
    if (key === "admin/prompts" && verb === "GET")
      return answer(all("prompts"));
    if (key === "admin/prompts" && verb === "POST") {
      z.object({
        body: z.string().min(20).max(20000),
        name: z.string().max(100),
      }).parse(body);
      return answer(
        put("prompts", { name: body.name, body: body.body, active: false }),
      );
    }
    if (
      route[0] === "admin" &&
      route[1] === "prompts" &&
      route[3] === "activate"
    ) {
      const target = get("prompts", route[2]);
      if (!target)
        throw new AppError("NOT_FOUND", "프롬프트를 찾을 수 없어요.", 404);
      transaction(() => {
        for (const p of all("prompts"))
          put("prompts", { ...p, active: p.id === target.id });
      });
      return answer({ active: target.id });
    }
    if (key === "admin/content" && verb === "GET")
      return answer({
        edits: all("content"),
        contributions: all("contributions"),
        prompts: all("prompts"),
        sources: catalog().sources,
      });
    if (
      route[0] === "admin" &&
      route[1] === "content" &&
      ["POST", "PATCH"].includes(verb)
    ) {
      if (verb === "PATCH") {
        const previous = get("content", route[2]);
        if (!previous)
          throw new AppError("NOT_FOUND", "편집 이력이 없어요.", 404);
        body = { ...previous, ...body, id: previous.id };
      }
      if (
        ![
          "recipes",
          "articles",
          "ingredients",
          "equipment",
          "substitutions",
          "challenges",
        ].includes(body.kind)
      )
        throw new AppError(
          "INVALID_CONTENT_STATE",
          "지원하지 않는 콘텐츠 유형이에요.",
        );
      if (!body.payload?.id || (!body.payload?.title && !body.payload?.name))
        throw new AppError(
          "INVALID_CONTENT_STATE",
          "ID와 제목 또는 이름이 필요해요.",
        );
      if (
        body.status === "PUBLISHED" &&
        (!body.payload.sourceIds?.length || body.payload.tested)
      )
        throw new AppError(
          "INVALID_CONTENT_STATE",
          "출처를 연결하고 실제 제조 검증 표시는 검증 기록이 있을 때만 사용해 주세요.",
        );
      if (
        body.payload.sourceIds?.some(
          (id: string) => !catalog().sources.some((s) => s.id === id),
        )
      )
        throw new AppError(
          "INVALID_CONTENT_STATE",
          "자료 목록에 없는 출처 ID가 있어요.",
        );
      if (
        body.kind === "recipes" &&
        body.payload.ingredients?.some(
          (i: any) => !catalog().ingredients.some((x) => x.id === i.id),
        )
      )
        throw new AppError(
          "INVALID_CONTENT_STATE",
          "재료 사전에 없는 ID가 있어요.",
        );
      if (body.kind === "recipes")
        z.object({
          ingredients: z
            .array(
              z.object({
                id: z.string(),
                quantity: number.positive(),
                unit: z.string(),
              }),
            )
            .min(1),
          steps: z.array(z.object({ text: z.string().min(5) })).min(1),
        }).parse(body.payload);
      const row = put("content", { ...body, id: body.id ?? randomUUID() });
      if (body.contributionId) {
        const contribution = get("contributions", body.contributionId);
        if (contribution)
          put(
            "contributions",
            {
              ...contribution,
              status:
                body.status === "PUBLISHED" ? "PUBLISHED" : "REVIEW_PENDING",
            },
            contribution.profileId,
          );
      }
      return answer(row);
    }
    if (key === "ai/chat") return answer(await askAi(body, profileId));
    if (key === "ai/recognize-ingredients") {
      const upload = get("uploads", body.uploadId, profileId);
      if (!upload)
        throw new AppError("NOT_FOUND", "사진을 찾을 수 없어요.", 404);
      const data = readFileSync(
        path.join(dataDirectory(), "uploads", upload.file),
      );
      return answer(
        await recognizeImage(
          `data:image/webp;base64,${data.toString("base64")}`,
          body.consent,
        ),
      );
    }
    if (route[0] === "uploads") {
      if (verb === "GET") {
        const upload = get("uploads", route[1], profileId);
        if (!upload)
          throw new AppError("NOT_FOUND", "사진을 찾을 수 없어요.", 404);
        return new NextResponse(
          readFileSync(path.join(dataDirectory(), "uploads", upload.file)),
          {
            headers: {
              "Content-Type": "image/webp",
              "Cache-Control": "private, no-store",
            },
          },
        );
      }
      const data = await req.formData();
      const file = data.get("file");
      if (
        !(file instanceof File) ||
        file.size > 5_000_000 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        throw new AppError(
          "UPLOAD_INVALID",
          "5MB 이하 JPEG·PNG·WebP만 선택해 주세요.",
        );
      const original = Buffer.from(await file.arrayBuffer());
      const image = sharp(original, { limitInputPixels: 20_000_000 });
      const buffer = await image
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
      const id = randomUUID();
      const dir = path.join(dataDirectory(), "uploads");
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, `${id}.webp`), buffer);
      return answer(
        put(
          "uploads",
          { id, file: `${id}.webp`, originalSize: file.size },
          profileId,
        ),
      );
    }
    if (key === "export") {
      if (req.nextUrl.searchParams.get("format") === "zip")
        return new NextResponse(createBackupZip(profileId), {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition":
              'attachment; filename="baking-lab-backup.zip"',
          },
        });
      return answer(backup(profileId));
    }
    if (key === "import/preview" || key === "import/archive-preview") {
      let archiveFiles: Record<string, string> = {};
      if (key === "import/archive-preview") {
        const form = await req.formData();
        const file = form.get("file");
        if (!(file instanceof File) || file.size > 20_000_000)
          throw new AppError(
            "IMPORT_INVALID",
            "20MB 이하 백업 ZIP만 가져올 수 있어요.",
          );
        const parsed = parseBackupZip(new Uint8Array(await file.arrayBuffer()));
        body = parsed.payload;
        archiveFiles = parsed.images;
        for (const [id, image] of Object.entries(archiveFiles)) {
          const cleaned = await sharp(Buffer.from(image, "base64"), {
            limitInputPixels: 20_000_000,
          })
            .rotate()
            .webp()
            .toBuffer();
          archiveFiles[id] = cleaned.toString("base64");
        }
      }
      if (
        body.schemaVersion !== 1 ||
        !body.data ||
        typeof body.data !== "object"
      )
        throw new AppError("IMPORT_INVALID", "지원되는 백업 형식이 아니에요.");
      for (const [name, rows] of Object.entries(body.data)) {
        if (
          !stores.includes(name as Store) ||
          !Array.isArray(rows) ||
          rows.length > 10000
        )
          throw new AppError("IMPORT_INVALID", "백업 항목을 확인해 주세요.");
        for (const row of rows) validateRecord(name as Store, row);
      }
      const row = put(
        "previews",
        {
          kind: "import",
          payload: body,
          archiveFiles,
          expiresAt: Date.now() + 600000,
        },
        profileId,
      );
      return answer({
        previewToken: row.id,
        counts: {
          ...Object.fromEntries(
            Object.entries(body.data).map(([k, v]) => [k, (v as any[]).length]),
          ),
          photos: Object.keys(archiveFiles).length,
        },
        notice: Object.keys(archiveFiles).length
          ? "기존 자료를 유지하고 사진을 포함해 새 ID로 병합해요."
          : "기존 자료를 유지하고 새 ID로 병합해요. JSON만 가져오면 기존 업로드 사진은 포함되지 않아요.",
      });
    }
    if (key === "import/confirm") {
      const preview = get("previews", body.previewToken, profileId);
      if (
        !preview ||
        preview.kind !== "import" ||
        preview.expiresAt < Date.now()
      )
        throw new AppError(
          "IMPORT_INVALID",
          "미리보기부터 다시 진행해 주세요.",
        );
      transaction(() => {
        const idMap = new Map<string, string>();
        for (const rows of Object.values(preview.payload.data) as any[][])
          for (const row of rows) idMap.set(row.id, randomUUID());
        for (const id of Object.keys(preview.archiveFiles ?? {}))
          idMap.set(id, randomUUID());
        const remap = (v: any): any =>
          typeof v === "string"
            ? (idMap.get(v) ?? v)
            : Array.isArray(v)
              ? v.map(remap)
              : v && typeof v === "object"
                ? Object.fromEntries(
                    Object.entries(v).map(([k, x]) => [k, remap(x)]),
                  )
                : v;
        for (const [s, rows] of Object.entries(preview.payload.data))
          for (const row of rows as any[])
            put(
              s as Store,
              { ...remap(row), id: idMap.get(row.id), version: undefined },
              profileId,
            );
        const dir = path.join(dataDirectory(), "uploads");
        mkdirSync(dir, { recursive: true });
        for (const [oldId, image] of Object.entries(
          preview.archiveFiles ?? {},
        )) {
          const id = idMap.get(oldId)!;
          writeFileSync(
            path.join(dir, `${id}.webp`),
            Buffer.from(image as string, "base64"),
          );
          put("uploads", { id, file: `${id}.webp` }, profileId);
        }
        remove("previews", preview.id, profileId);
      });
      return answer({ imported: true });
    }
    if (route[0] === "inventory-consumptions") {
      const log = get("journal", body.bakeLogId, profileId);
      if (!log)
        throw new AppError("NOT_FOUND", "완성 기록을 먼저 저장해 주세요.", 404);
      if (route[1] === "preview") {
        const recipe = log.recipe as Recipe;
        const changes =
          recipe?.ingredients
            .filter((i) => !i.optional)
            .map((i) => {
              const lots = all("pantry", profileId).filter(
                (p) => p.ingredientId === i.id && p.quantity !== null,
              );
              let remaining = i.quantity;
              const lotsChanges = lots.map((l) => {
                try {
                  const available = convertDifferentCups(
                    l.quantity,
                    l.unit,
                    i.unit,
                    catalog().ingredients.find((ing) => ing.id === i.id),
                    l.cupMl ?? 240,
                    recipe.cupMl ?? 240,
                  );
                  const used = Math.min(remaining, available);
                  remaining -= used;
                  return {
                    id: l.id,
                    expectedVersion: l.version,
                    quantity: convertDifferentCups(
                      available - used,
                      i.unit,
                      l.unit,
                      catalog().ingredients.find((ing) => ing.id === i.id),
                      recipe.cupMl ?? 240,
                      l.cupMl ?? 240,
                    ),
                  };
                } catch {
                  return {
                    id: l.id,
                    expectedVersion: l.version,
                    quantity: l.quantity,
                  };
                }
              });
              return {
                ingredientId: i.id,
                missing: remaining,
                lots: lotsChanges,
              };
            }) ?? [];
        const p = put(
          "previews",
          {
            kind: "consumption",
            bakeLogId: log.id,
            changes,
            expiresAt: Date.now() + 600000,
          },
          profileId,
        );
        return answer({ previewToken: p.id, changes });
      }
      const p = get("previews", body.previewToken, profileId);
      if (!p || p.kind !== "consumption" || p.expiresAt < Date.now())
        throw new AppError(
          "STALE_VERSION",
          "차감 미리보기를 다시 만들어 주세요.",
        );
      if (
        all("consumptions", profileId).some((x) => x.bakeLogId === p.bakeLogId)
      )
        return answer({ alreadyConsumed: true });
      transaction(() => {
        for (const change of p.changes)
          for (const lot of change.lots) {
            const row = get("pantry", lot.id, profileId);
            if (row)
              put(
                "pantry",
                {
                  ...row,
                  expectedVersion: lot.expectedVersion,
                  quantity: lot.quantity,
                },
                profileId,
              );
          }
        put("consumptions", { bakeLogId: p.bakeLogId }, profileId);
      });
      return answer({ consumed: true });
    }
    // 명세의 의미 있는 주소와 화면용 공통 저장 주소가 같은 저장 함수를 사용합니다.
    const aliases: Record<string, Store> = {
      journal: "journal",
      "saved-recipes": "saved",
      collections: "collections",
      prices: "prices",
      "bake-sessions": "sessions",
      "challenge-attempts": "attempts",
      contributions: "contributions",
    };
    let store: Store | undefined, id: string | undefined;
    if (route[0] === "state") {
      store = ownedStore(route[1]);
      id = route[2];
    } else if (route[0] === "kitchen") {
      store =
        route[1] === "ingredients"
          ? "pantry"
          : route[1] === "equipment"
            ? "equipment"
            : undefined;
      id = route[2];
    } else {
      store = aliases[route[0]];
      id = route[1];
    }
    if (store) {
      if (verb === "GET")
        return answer(
          id ? (get(store, id, profileId) ?? null) : all(store, profileId),
        );
      if (verb === "DELETE" && id) {
        if (store === "saved" && route[0] === "saved-recipes") {
          id =
            all("saved", profileId).find(
              (x) => x.recipeId === id || x.id === id,
            )?.id ?? id;
        }
        if (store === "collections") {
          transaction(() => {
            for (const item of all("saved", profileId).filter(
              (x) => x.collectionId === id,
            ))
              put("saved", { ...item, collectionId: null }, profileId);
            remove(store!, id!, profileId);
          });
        } else remove(store, id, profileId);
        return answer({ deleted: true });
      }
      if (verb === "PATCH" || verb === "POST") {
        const current = id ? get(store, id, profileId) : undefined;
        const data = { ...current, ...body, id: id ?? body.id ?? randomUUID() };
        validateRecord(store, data);
        if (store === "saved") {
          const saved = all("saved", profileId).find(
            (s) => s.recipeId === data.recipeId,
          );
          if (saved) data.id = saved.id;
        }
        if (store === "contributions") data.status = "REVIEW_PENDING";
        return answer(put(store, data, profileId), verb === "POST" ? 201 : 200);
      }
    }
    throw new AppError("NOT_FOUND", "요청한 기능을 찾을 수 없어요.", 404);
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "입력 값을 확인해 주세요.",
            fieldErrors: error.flatten(),
          },
        },
        { status: 422 },
      );
    if (error instanceof AppError)
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            retryable: error.status >= 500,
          },
        },
        { status: error.status },
      );
    return NextResponse.json(
      {
        error: {
          code: "REQUEST_FAILED",
          message: "처리하지 못했어요. 입력을 확인하고 다시 시도해 주세요.",
          retryable: true,
        },
      },
      { status: 500 },
    );
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
