import { safeFeedFetch, parseFeed } from "../lib/integrations";
// 실제 수집 경로를 확인할 때만 실행하는 공개 RSS 읽기 검사입니다.
async function main() {
  const robots = await safeFeedFetch(
    "https://sallysbakingaddiction.com/robots.txt",
    "sallysbakingaddiction.com",
  );
  const feed = await safeFeedFetch(
    "https://sallysbakingaddiction.com/feed/",
    "sallysbakingaddiction.com",
  );
  console.log(
    JSON.stringify({
      robots,
      items: parseFeed(feed).slice(0, 2),
      total: parseFeed(feed).length,
    }),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
