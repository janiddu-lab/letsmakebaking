import type { NextConfig } from "next";
// 로컬 서버에서만 사용하는 파일 DB와 이미지 처리는 서버 전용으로 남깁니다.
const config: NextConfig = {
  serverExternalPackages: ["sharp", "playwright-core"],
  devIndicators: false,
};
export default config;
