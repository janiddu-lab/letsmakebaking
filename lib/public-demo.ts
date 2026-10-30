import { createHash, timingSafeEqual } from "node:crypto";

// 공유용 공개 배포는 별도 DB를 사용하고 새 수집은 별도 코드로 보호합니다. 로컬 버전에는 적용되지 않습니다.
export function publicDemoAllows(key: string, method: string) {
  if (["GET", "HEAD"].includes(method)) {
    return ["health", "bootstrap", "challenges", "trends", "features/social", "features/twins"].includes(key)
      || /^recipes(?:\/[a-zA-Z0-9_-]+)?$/.test(key)
      || /^articles(?:\/[a-zA-Z0-9_-]+)?$/.test(key);
  }
  return method === "POST" && ["matches", "calculations", "features/pan", "features/autopsy"].includes(key);
}


export function collectionIsConfigured(enabled = process.env.BAKING_ENABLE_COLLECTION, code = process.env.BAKING_COLLECTION_CODE) {
  return enabled === "true" && typeof code === "string" && code.length >= 12 && code.length <= 256;
}

export function publicCollectionAuthorized(key: string, method: string, provided: string, enabled = process.env.BAKING_ENABLE_COLLECTION, code = process.env.BAKING_COLLECTION_CODE) {
  if (method !== "POST" || !["features/social/start", "features/social/step"].includes(key)
    || !collectionIsConfigured(enabled, code) || !provided || provided.length > 256) return false;
  // 비밀 코드의 길이에 의존하는 비교를 피하고, 코드 자체는 로그나 응답에 넣지 않습니다.
  return timingSafeEqual(createHash("sha256").update(provided).digest(), createHash("sha256").update(code!).digest());
}
