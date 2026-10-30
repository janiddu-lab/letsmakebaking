import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { readFileSync } from "node:fs";
import path from "node:path";
import { all, backup, dataDirectory } from "./db";
import { AppError } from "./types";
// 백업은 로컬 파일로만 내려갑니다. 키·환경 변수·다른 프로필의 사진은 넣지 않습니다.
export function createBackupZip(profileId: string) {
  const data = backup(profileId);
  const referenced = new Set(
    data.data.journal.flatMap((l: any) => l.photos ?? []),
  );
  const files: Record<string, Uint8Array> = {
    "data.json": strToU8(JSON.stringify(data)),
  };
  for (const upload of all("uploads", profileId).filter((u) =>
    referenced.has(u.id),
  )) {
    try {
      files[`uploads/${upload.id}.webp`] = readFileSync(
        path.join(dataDirectory(), "uploads", upload.file),
      );
    } catch {}
  }
  return zipSync(files, { level: 0 });
}
export function parseBackupZip(buffer: Uint8Array) {
  let total = 0,
    count = 0;
  const files = unzipSync(buffer, {
    filter: (file) => {
      // 압축 해제 전에 크기와 이름을 검사해 경로 탈출과 과도한 메모리 사용을 막습니다.
      total += file.originalSize;
      count++;
      if (total > 20_000_000 || count > 200 || file.originalSize > 6_000_000)
        throw new AppError("IMPORT_INVALID", "압축을 푼 백업이 너무 커요.");
      if (
        file.name !== "data.json" &&
        !/^uploads\/[a-zA-Z0-9-]+\.webp$/.test(file.name)
      )
        throw new AppError(
          "IMPORT_INVALID",
          "백업에 허용되지 않은 파일 경로가 있어요.",
        );
      return true;
    },
  });
  if (!files["data.json"])
    throw new AppError("IMPORT_INVALID", "백업의 data.json이 없어요.");
  const payload = JSON.parse(strFromU8(files["data.json"]));
  const images = Object.fromEntries(
    Object.entries(files)
      .filter(([name]) => name !== "data.json")
      .map(([name, bytes]) => [
        name.slice(8, -5),
        Buffer.from(bytes).toString("base64"),
      ]),
  );
  return { payload, images };
}
