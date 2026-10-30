import type { Metadata } from "next";
import "./globals.css";
import "./kitsch.css";
export const metadata: Metadata = {
  title: "우리집 베이킹랩 | 가진 것으로 시작하는 베이킹",
  description: "재료와 도구로 찾고, 실험하고, 기록하는 나만의 베이킹 작업실",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
