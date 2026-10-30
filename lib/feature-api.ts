import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { all, put, get, dataDirectory, catalog } from "./db";
import { AppError } from "./types";
import { autopsy, panPlan, summarizeTwins } from "./science";
import { collectSocial, latestSocial } from "./social-trends";
import { activeSocialJob, startSocialJob, stepSocialJob } from "./social-job";

const positive = z.coerce.number().finite().positive();
// 날씨는 도시별 공통 자료만 캐시합니다. 방문자의 개인 기록은 공개 서버 DB에 쓰지 않습니다.
const publicWeather = new Map<string, any>();
export async function featureApi(
  req: NextRequest,
  key: string,
  body: any,
  profileId: string,
  answer: (v: unknown, status?: number) => NextResponse,
): Promise<NextResponse | null> {
  if (key === "features/autopsy") {
    const input = z
      .object({
        symptom: z.string(),
        facts: z.record(z.string(), z.enum(["yes", "no", "unknown"])),
        recipeId: z.string().optional(),
      })
      .parse(body);
    const result = autopsy(input.symptom, input.facts);
    if (process.env.BAKING_PUBLIC_DEMO === "true") return answer({ id: "demo-autopsy", kind: "autopsy", ...input, result });
    const saved = put(
      "settings",
      { kind: "autopsy", ...input, result },
      profileId,
    );
    return answer(saved);
  }
  if (key === "features/pan") {
    const spec = z.object({
      shape: z.enum(["round", "rect", "muffin"]),
      width: positive.max(100),
      length: positive.max(100).optional(),
      depth: positive.max(20),
      count: positive.int().max(100),
    });
    const input = z
      .object({ original: spec, target: spec, minutes: positive.max(600) })
      .parse(body);
    return answer(panPlan(input.original, input.target, input.minutes));
  }
  if (key === "features/twins") {
    if (req.method === "GET") {
      const protocol = req.nextUrl.searchParams.get("protocol") ?? "";
      return answer(summarizeTwins(all("settings"), protocol));
    }
    const input = z
      .object({
        recipeId: z.string(),
        variable: z.enum(["chill", "butter", "sugar", "pan"]),
        aValue: z.string().min(1).max(40),
        bValue: z.string().min(1).max(40),
        aDiameter: positive.max(1000),
        bDiameter: positive.max(1000),
        aThickness: positive.max(500),
        bThickness: positive.max(500),
        ovenId: z.string().min(1).max(100),
        controlled: z.boolean(),
        shared: z.boolean(),
        photos: z.array(z.string()).max(2),
        note: z.string().max(3000),
      })
      .parse(body);
    const recipe = catalog().recipes.find((r) => r.id === input.recipeId);
    if (!recipe) throw new AppError("INVALID_RECIPE", "레시피를 선택하세요.");
    if (input.aValue === input.bValue)
      throw new AppError("INVALID_EXPERIMENT", "A와 B의 바꿀 조건이 같아요.");
    const batchKey = createHash("sha256")
      .update(JSON.stringify(recipe.ingredients))
      .digest("hex")
      .slice(0, 16);
    const protocolKey = JSON.stringify([
      input.recipeId,
      batchKey,
      input.variable,
      input.aValue.trim(),
      input.bValue.trim(),
    ]);
    const saved = put(
      "settings",
      { ...input, kind: "twin-experiment", protocolKey, batchKey },
      profileId,
    );
    return answer({
      saved,
      summary: summarizeTwins(all("settings"), protocolKey),
    });
  }
  if (key === "features/social/start") {
    const input = z.object({ platforms: z.array(z.enum(["bluesky", "youtube", "instagram"])).min(1), instagramUrls: z.array(z.string().max(500)).max(8).default([]) }).parse(body);
    return answer({ job: startSocialJob(input.platforms, input.instagramUrls) });
  }
  if (key === "features/social/step") {
    const input = z.object({ jobId: z.string().uuid(), stop: z.boolean().default(false) }).parse(body);
    return answer(await stepSocialJob(input.jobId, input.stop));
  }
  if (key === "features/social")
    return answer(
      req.method === "GET"
          ? { ...latestSocial(), job: activeSocialJob() }
        : {
            run: await collectSocial(
              z
                .array(z.enum(["bluesky", "youtube", "instagram"]))
                .min(1)
                .parse(body.platforms),
                z.array(z.string().max(500)).max(8).default([]).parse(body.instagramUrls),
            ),
            connections: latestSocial().connections,
          },
    );
  if (key === "features/weather") {
    const cities: Record<string, { name: string; lat: number; lon: number }> = {
      seoul: { name: "서울", lat: 37.57, lon: 126.98 },
      busan: { name: "부산", lat: 35.18, lon: 129.08 },
      daegu: { name: "대구", lat: 35.87, lon: 128.6 },
      daejeon: { name: "대전", lat: 36.35, lon: 127.38 },
      gwangju: { name: "광주", lat: 35.16, lon: 126.85 },
      jeju: { name: "제주", lat: 33.5, lon: 126.53 },
    };
    const city = cities[body.city];
    if (!city) throw new AppError("INVALID_CITY", "도시를 선택하세요.");
    const publicMode = process.env.BAKING_PUBLIC_DEMO === "true";
    const sharedWeather = publicWeather.get(body.city);
    if (publicMode && sharedWeather && Date.now() - Date.parse(sharedWeather.fetchedAt) < 600000) return answer(sharedWeather);
    const cached = all("settings", profileId).find(
      (s) =>
        s.kind === "weather" &&
        s.city === body.city &&
        Date.now() - Date.parse(s.fetchedAt) < 600000,
    );
    if (cached) return answer(cached);
    const params = new URLSearchParams({
      latitude: String(city.lat),
      longitude: String(city.lon),
      current: "temperature_2m,relative_humidity_2m",
      timezone: "Asia/Seoul",
      forecast_days: "1",
    });
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      { signal: AbortSignal.timeout(10000), redirect: "error" },
    );
    if (!response.ok)
      throw new AppError(
        "WEATHER_FAILED",
        "날씨를 가져오지 못했어요. 실내 값을 직접 입력할 수 있어요.",
        502,
      );
    const json = await response.json();
    const weather = z
      .object({
        temperature_2m: z.number(),
        relative_humidity_2m: z.number(),
        time: z.string(),
      })
      .parse(json.current);
    const record = {
          kind: "weather",
          city: body.city,
          cityName: city.name,
          temperature: weather.temperature_2m,
          humidity: weather.relative_humidity_2m,
          weatherTime: weather.time,
          fetchedAt: new Date().toISOString(),
          source: "Open-Meteo · CC BY 4.0",
          sourceUrl: "https://open-meteo.com/",
        };
    if (publicMode) { publicWeather.set(body.city, record); return answer(record); }
    return answer(put("settings", record, profileId));
  }
  if (key === "features/models/import") {
    const form = await req.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith(".glb") ||
      file.size > 20_000_000
    )
      throw new AppError(
        "INVALID_MODEL",
        "20MB 이하의 자체 포함 GLB 파일을 선택하세요.",
      );
    const data = Buffer.from(await file.arrayBuffer());
    if (
      data.length < 24 ||
      data.readUInt32LE(0) !== 0x46546c67 ||
      data.readUInt32LE(4) !== 2 ||
      data.readUInt32LE(8) !== data.length ||
      data.readUInt32LE(16) !== 0x4e4f534a
    )
      throw new AppError("INVALID_MODEL", "올바른 GLB 2.0 파일이 아니에요.");
    const size = data.readUInt32LE(12);
    if (size > 2_000_000 || size + 20 > data.length)
      throw new AppError(
        "INVALID_MODEL",
        "모델 JSON 크기 또는 청크가 올바르지 않아요.",
      );
    const json = JSON.parse(
      data
        .subarray(20, 20 + size)
        .toString("utf8")
        .trim(),
    );
    const uris = [...(json.buffers ?? []), ...(json.images ?? [])]
      .map((x: any) => x.uri)
      .filter(Boolean);
    if (uris.some((u: any) => typeof u !== "string" || !u.startsWith("data:")))
      throw new AppError(
        "INVALID_MODEL",
        "텍스처와 버퍼를 파일 안에 포함해 GLB로 내보내 주세요.",
      );
    if (
      (json.extensionsUsed ?? []).some((e: string) =>
        [
          "KHR_draco_mesh_compression",
          "EXT_meshopt_compression",
          "KHR_texture_basisu",
        ].includes(e),
      )
    )
      throw new AppError(
        "INVALID_MODEL",
        "오프라인 사용을 위해 Draco·Meshopt·KTX 압축을 끄고 내보내 주세요.",
      );
    let offset = 12;
    while (offset < data.length) {
      if (offset + 8 > data.length)
        throw new AppError("INVALID_MODEL", "GLB 청크가 잘렸어요.");
      const length = data.readUInt32LE(offset);
      if (length % 4 || offset + 8 + length > data.length)
        throw new AppError("INVALID_MODEL", "GLB 청크 길이를 확인하세요.");
      offset += 8 + length;
    }
    const id = randomUUID();
    const directory = path.join(dataDirectory(), "uploads");
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, `${id}.glb`), data);
    put(
      "uploads",
      { id, file: `${id}.glb`, mime: "model/gltf-binary" },
      profileId,
    );
    return answer(
      put(
        "settings",
        {
          kind: "custom-model",
          uploadId: id,
          name: file.name.slice(0, 100),
          byteSize: file.size,
        },
        profileId,
      ),
    );
  }
  if (key.startsWith("features/models/") && req.method === "GET") {
    const id = key.split("/")[2];
    const record = get("uploads", id, profileId);
    if (!record || record.mime !== "model/gltf-binary")
      throw new AppError("NOT_FOUND", "모델을 찾지 못했어요.", 404);
    return new NextResponse(
      readFileSync(path.join(dataDirectory(), "uploads", record.file)),
      {
        headers: {
          "Content-Type": "model/gltf-binary",
          "Cache-Control": "private, max-age=3600",
        },
      },
    );
  }
  return null;
}
