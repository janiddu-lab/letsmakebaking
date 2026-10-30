import { defineConfig } from "vitest/config";
// 실제 사용자 DB를 사용하지 않는 도메인 검증만 기본 검사로 실행합니다.
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
