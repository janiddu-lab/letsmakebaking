import { all, put } from "../lib/db";
import { collectTrends } from "../lib/integrations";
// 공개 RSS와 robots.txt를 읽어 확인한 수집원입니다. 제목·링크·날짜만 로컬에 보관합니다.
async function main() {
  const source =
    all("trendSources").find(
      (s) => s.url === "https://sallysbakingaddiction.com/feed/",
    ) ??
    put("trendSources", {
      name: "Sally의 베이킹 공개 RSS",
      url: "https://sallysbakingaddiction.com/feed/",
      enabled: true,
      termsChecked: true,
      termsCheckedAt: new Date().toISOString(),
      note: "공개 RSS 원문 링크와 제목·날짜 메타데이터만 개인 로컬 탐색에 사용. 원문·사진 재게시 없음. robots.txt 피드 경로 금지 없음 확인.",
    });
  const result = await collectTrends([source.id]);
  console.log(
    JSON.stringify({
      status: result.status,
      inserted: result.inserted,
      duplicates: result.duplicates,
      errors: result.errors,
    }),
  );
  if (result.status === "failed") process.exitCode = 1;
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
