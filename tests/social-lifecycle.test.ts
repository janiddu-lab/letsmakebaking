import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
const memory = vi.hoisted(() => ({ rows: [] as any[], sequence: 0 }));
vi.mock("../lib/db", () => ({
  all: () => structuredClone(memory.rows),
  get: (_table: string, id: string) => structuredClone(memory.rows.find((r) => r.id === id)),
  put: (_table: string, data: any) => {
    const row = structuredClone({ ...data, id: data.id ?? `fixture-${++memory.sequence}` });
    const index = memory.rows.findIndex((r) => r.id === row.id);
    if (index < 0) memory.rows.push(row); else memory.rows[index] = row;
    return structuredClone(row);
  },
}));
vi.mock("../lib/social-trends", async (original) => ({ ...await original<any>(), blueskyPage: vi.fn() }));
vi.mock("../lib/public-social", async (original) => ({ ...await original<any>(), crawlYoutubeQuery: vi.fn(), crawlInstagram: vi.fn() }));
import { blueskyPage, latestSocial } from "../lib/social-trends";
import { startSocialJob, stepSocialJob } from "../lib/social-job";
import { crawlInstagram } from "../lib/public-social";
const sample = (n: number) => ({ id: `post-${n}`, platform: "bluesky", author: `baker-${n}`, text: `쿠키 실험 ${n}`, url: "https://bsky.app/", publishedAt: "2026-10-29T01:00:00Z" });

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-29T05:00:00Z"));
  memory.rows = []; memory.sequence = 0; vi.clearAllMocks();
  vi.mocked(blueskyPage).mockImplementation(async (query) => ({ posts: [sample(query === "베이킹" ? 1 : 2)], cursor: undefined }));
});
afterEach(() => vi.useRealTimers());
describe("저장되는 수집 작업", () => {
  it("Instagram은 한 번에 한 검색어만 실행하고 기간 밖 읽기를 조회 실패와 구분한다", async () => {
    vi.mocked(crawlInstagram).mockResolvedValue({ posts: [{ ...sample(99), platform: "instagram", publishedAt: "2026-09-01T01:00:00Z" }], warnings: [] });
    const job = startSocialJob(["instagram"]);
    await stepSocialJob(job.id);
    expect(crawlInstagram).toHaveBeenCalledTimes(1);
    await stepSocialJob(job.id, true);
    expect(latestSocial().run?.posts).toHaveLength(0);
    expect(latestSocial().run?.status).toBe("no_recent_posts");
    expect(latestSocial().run?.instagramObserved).toHaveLength(1);
  });
  it("진행량을 저장하고 다음 날 이어가도 ID와 기간을 유지한다", async () => {
    const job = startSocialJob(["bluesky"]);
    const first = await stepSocialJob(job.id);
    expect(first.job.collected).toBe(2);
    vi.setSystemTime(new Date("2026-10-30T05:00:00Z"));
    const resumed = startSocialJob(["bluesky"]);
    expect(resumed.id).toBe(job.id);
    expect(resumed.collected).toBe(2);
    expect(resumed.until).toBe(job.until);
  });
  it("일시 정지 후 현재 자료로 마무리하면 실제 결과를 저장한다", async () => {
    const job = startSocialJob(["bluesky"]);
    await stepSocialJob(job.id);
    const stopped = await stepSocialJob(job.id, true);
    expect(stopped.job.status).toBe("stopped");
    expect(latestSocial().run?.posts).toHaveLength(2);
    expect(latestSocial().run?.targetReached).toBe(false);
  });
  it("2,000개의 고유 자료가 있으면 추가 조회 없이 목표 달성으로 마무리한다", async () => {
    const job = startSocialJob(["bluesky"]);
    memory.rows.find((r) => r.id === job.id).posts = Array.from({ length: 2000 }, (_, i) => sample(i));
    const result = await stepSocialJob(job.id);
    expect(result.job.status).toBe("target_reached");
    expect(result.job.collected).toBe(2000);
    expect(blueskyPage).not.toHaveBeenCalled();
    expect(latestSocial().run?.today.posts).toHaveLength(2000);
  });
  it("접근 거부를 받으면 그 출처에 계속 요청하지 않고 목표 미달로 표시한다", async () => {
    vi.mocked(blueskyPage).mockRejectedValue(new Error("접근 거부 403"));
    const job = startSocialJob(["bluesky"]);
    const result = await stepSocialJob(job.id);
    expect(result.job.status).toBe("insufficient");
    expect(result.job.remainingTasks).toBe(0);
    expect(latestSocial().run?.targetReached).toBe(false);
  });
  it("날짜가 바뀌어도 완료 결과를 보존하고 이전 날짜 자료임을 표시한다", async () => {
    const job = startSocialJob(["bluesky"]);
    await stepSocialJob(job.id);
    await stepSocialJob(job.id, true);
    vi.setSystemTime(new Date("2026-10-30T05:00:00Z"));
    const run = latestSocial().run;
    expect(run?.isStale).toBe(true);
    expect(run?.day).toBe("2026-10-29");
    expect(run?.posts).toHaveLength(2);
  });
  it("동시에 이어가기 요청이 와도 조회와 저장이 중복되지 않는다", async () => {
    const pending: ((value: any) => void)[] = [];
    vi.mocked(blueskyPage).mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const job = startSocialJob(["bluesky"]);
    const first = stepSocialJob(job.id);
    const concurrent = await stepSocialJob(job.id);
    expect(concurrent.job.requests).toBe(0);
    pending.forEach((resolve, i) => resolve({ posts: [sample(i)], cursor: undefined }));
    const completed = await first;
    expect(completed.job.requests).toBe(2);
    expect(blueskyPage).toHaveBeenCalledTimes(2);
  });
});
