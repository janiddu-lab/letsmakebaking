import { all, get, put } from "./db";
import { AppError } from "./types";
import { blueskyPage, kstDayWindow, summarizeSocial, socialConnections, type SocialPost } from "./social-trends";
import { crawlYoutubeQuery, crawlInstagram } from "./public-social";
import { isBakingRelated } from "./baking-relevance";
import { emitCollectionLive } from "./collection-live";

type Task = { platform: string; query: string; since?: string; until?: string; pages: number };
const queries = ["베이킹", "홈베이킹", "디저트", "신상 디저트", "쿠키", "버터떡", "두쫀쿠", "빵", "baking", "dessert", "cookies", "pastry", "cake", "sourdough"];
export function weekWindow(now = new Date()) {
  const today = kstDayWindow(now);
  return { ...today, since: new Date(Date.parse(today.since) - 6 * 86400000).toISOString(), days: 7, todaySince: today.since };
}
export function relevantPost(post: SocialPost) {
  // ‘베이킹소다 청소’ 같은 검색 잡음을 목표 수량으로 채우지 않습니다.
  return isBakingRelated(post.text);
}
export function uniqueSample(posts: SocialPost[], since: string, until: string) {
  const seenIds = new Set<string>(), seenTexts = new Set<string>();
  return posts.filter((p) => {
    const t = Date.parse(p.publishedAt);
    const hash = p.text.toLowerCase().replace(/https?:\/\/\S+/g, "").replace(/\s+/g, "").slice(0, 500);
    if (!Number.isFinite(t) || t < Date.parse(since) || t > Date.parse(until)
      || (p.timeRangeStart && Date.parse(p.timeRangeStart) < Date.parse(since))
      || (p.timeRangeEnd && Date.parse(p.timeRangeEnd) > Date.parse(until))
      || !hash || seenIds.has(p.id) || seenTexts.has(hash) || !relevantPost(p)) return false;
    seenIds.add(p.id); seenTexts.add(hash);
    return true;
  });
}
export function jobView(job: any) {
  const filtered = uniqueSample(job.posts, job.since, job.until);
  return { id: job.id, status: job.status === "target_reached" && filtered.length < job.target ? "insufficient" : job.status, target: job.target, collected: filtered.length, requests: job.requests,
    day: job.day,
    remainingTasks: job.tasks.length, since: job.since, until: job.until, todaySince: job.todaySince,
    todayCount: todayPosts(filtered, job.todaySince).length,
    errors: job.errors, notes: job.notes ?? [], startedAt: job.startedAt, finishedAt: job.finishedAt, nextStepAt: job.nextStepAt };
}
export function todayPosts(posts: SocialPost[], since: string) {
  return posts.filter((p) => Date.parse(p.publishedAt) >= Date.parse(since) && ((!p.timePrecision || p.timePrecision === "exact") || (p.timeRangeStart && Date.parse(p.timeRangeStart) >= Date.parse(since))));
}
export function activeSocialJob() {
  const job = all("settings").filter((r) => r.kind === "social-collection-job").at(-1);
  return job ? jobView(job) : null;
}
export function startSocialJob(platforms: string[], instagramUrls: string[] = [], demoBrowser = false) {
  const previous = all("settings").filter((r) => r.kind === "social-collection-job").at(-1);
  if (previous?.status === "running") return jobView(previous);
  if (previous && Date.now() - Date.parse(previous.startedAt) < 60000)
    throw new AppError("COLLECTION_INTERVAL", "새 수집은 1분 후 시작해 주세요. 기존 작업은 이어갈 수 있어요.");
  const window = weekWindow();
  const tasks: Task[] = [];
  for (let i = 0; i < queries.length; i++) {
    if (platforms.includes("bluesky")) tasks.push({ platform: "bluesky", query: queries[i], since: window.todaySince, until: window.until, pages: 0 });
    if (platforms.includes("youtube") && i < 8) tasks.push({ platform: "youtube", query: queries[i], pages: 0 });
    if (i < 5 && platforms.includes("instagram")) tasks.push({ platform: "instagram", query: ["베이킹", "홈베이킹", "디저트", "두쫀쿠", "상하이버터떡"][i], pages: 0 });
  }
  // 공개 검색의 다음 페이지는 인증 제한이 있어 사용하지 않고 지원되는 날짜 범위로 나눕니다.
  if (platforms.includes("bluesky")) for (let day = 1; day < 7; day++) {
    const end = new Date(Date.parse(window.todaySince) - (day - 1) * 86400000).toISOString();
    const start = new Date(Date.parse(window.todaySince) - day * 86400000).toISOString();
    for (const query of queries) tasks.push({ platform: "bluesky", query, since: start, until: end, pages: 0 });
  }
  // 같은 수집 기간의 실제 기존 자료만 합칩니다. 시연 자료는 사용하지 않습니다.
  const existing = all("settings").filter((r) => r.kind === "social-trend-run" && r.day === window.day).flatMap((r) => r.posts ?? []);
  const job = put("settings", { kind: "social-collection-job", ...window, target: 2000, requestedPlatforms: platforms,
    instagramUrls, demoBrowser, posts: uniqueSample(existing.filter((p: SocialPost) => platforms.includes(p.platform)), window.since, window.until),
    tasks, errors: [], notes: [], requests: 0, status: "running", startedAt: new Date().toISOString() });
  emitCollectionLive(job.id, { stage: "query", message: demoBrowser ? "실제 브라우저 시연 모드로 수집을 시작합니다." : "공개 자료 수집을 시작합니다." });
  return jobView(job);
}
const locks = globalThis as unknown as { bakingSocialJobs?: Set<string> };
locks.bakingSocialJobs ??= new Set();

export async function stepSocialJob(id: string, stop = false) {
  const job = get("settings", id);
  if (!job || job.kind !== "social-collection-job") throw new AppError("NOT_FOUND", "수집 작업을 찾을 수 없어요.", 404);
  if (job.status !== "running") return { job: jobView(job) };
  if (locks.bakingSocialJobs!.has(id)) return { job: jobView(job) };
  if (!stop && Date.now() < (job.nextStepAt ?? 0)) return { job: jobView(job) };
  locks.bakingSocialJobs!.add(id);
  try {
    // 매 요청에서 작은 묶음만 읽고 저장하여 페이지 새로고침·서버 재시작 뒤에도 이어갈 수 있게 합니다.
    // 무료 서버에서 Chromium 두 개가 동시에 실행되지 않게 Instagram은 한 검색어씩 처리합니다.
    const tasks = stop || job.posts.length >= job.target ? [] : job.tasks.splice(0, job.tasks[0]?.platform === "instagram" ? 1 : 2) as Task[];
    const results = await Promise.allSettled(tasks.map(async (task) => {
      emitCollectionLive(job.id, { stage: "query", message: `${task.platform}에서 ‘${task.query}’ 공개 자료를 조회합니다.`, platform: task.platform, query: task.query });
      if (task.platform === "bluesky") return { task, ...(await blueskyPage(task.query, task.since ?? job.since, task.until ?? job.until)) };
      if (task.platform === "youtube") return { task, posts: await crawlYoutubeQuery(task.query, job.since, job.until), cursor: undefined };
      const result = await crawlInstagram(job.instagramUrls, task.query, (event, image) => emitCollectionLive(job.id, event, image), !!job.demoBrowser);
      return { task, posts: result.posts, warnings: result.warnings, cursor: undefined };
    }));
    const extra: SocialPost[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        extra.push(...result.value.posts);
        if ("warnings" in result.value) job.notes = [...(job.notes ?? []), ...(result.value.warnings ?? [])].slice(-20);
      } else {
        const task = tasks[i];
        const message = result.reason instanceof Error ? result.reason.message : "조회 실패";
        job.errors.push(`${task.platform} (${task.query}): ${message}`);
        // 인증·속도 제한이 있는 출처를 같은 작업에서 계속 두드리지 않습니다.
        if (/401|403|429|로그인.*요구|접근 확인.*요구/.test(message)) job.tasks = job.tasks.filter((t: Task) => t.platform !== task.platform);
      }
    }
    for (const post of extra.slice(0, 6)) emitCollectionLive(job.id, { stage: "filter", message: "읽은 캡션의 날짜와 제과제빵 관련성을 검사합니다.", platform: post.platform, url: post.url, caption: post.text, publishedAt: post.publishedAt, included: uniqueSample([post], job.since, job.until).length > 0 });
    for (const result of results) if (result.status === "rejected") emitCollectionLive(job.id, { stage: "error", message: result.reason instanceof Error ? result.reason.message : "조회하지 못했습니다." });
    job.posts = uniqueSample([...job.posts, ...extra], job.since, job.until);
    // 실제로 읽은 Instagram 자료는 보존하되, 기간 밖 자료를 주간 2,000개에 넣지 않습니다.
    const instagram = [...(job.instagramObserved ?? []), ...extra.filter((p) => p.platform === "instagram" && relevantPost(p))] as SocialPost[];
    job.instagramObserved = [...new Map(instagram.map((p) => [p.id, p])).values()].slice(0, 60);
    job.requests += tasks.length;
    job.errors = [...new Set(job.errors)].slice(-20);
    job.nextStepAt = Date.now() + 1500;
    const reached = job.posts.length >= job.target;
    const finished = stop || reached || !job.tasks.length || job.requests >= 120;
    if (finished) {
      job.status = stop ? "stopped" : reached ? "target_reached" : "insufficient";
      job.finishedAt = new Date().toISOString();
      emitCollectionLive(job.id, { stage: "done", message: `조회가 끝났습니다. 기간·관련성 검사 후 ${job.posts.length}개가 집계됐습니다.` });
      const summary = summarizeSocial(job.posts, job.since, job.until);
      put("settings", { kind: "social-trend-run", ...weekWindow(new Date(job.until)), ...summary, day: job.day,
        collectedAt: job.finishedAt, retryAfter: new Date(Date.now() + 10000).toISOString(), target: job.target,
        targetReached: reached, collectionStatus: job.status, requestedPlatforms: job.requestedPlatforms,
        platforms: [...new Set(job.posts.map((p: SocialPost) => p.platform))], errors: job.errors,
        notes: job.notes ?? [],
        instagramObserved: job.instagramObserved ?? [],
        status: job.posts.length ? job.errors.length ? "partial" : "completed" : job.instagramObserved?.length ? "no_recent_posts" : "failed",
        today: summarizeSocial(todayPosts(job.posts, job.todaySince), job.todaySince, job.until),
        notice: "최근 7일(KST 오늘 포함 7개 날짜)의 공개 검색 표본입니다. 오늘 자료는 별도 집계하며 목표 미달은 그대로 표시합니다. SNS 전체의 인기 순위·상승률이 아닙니다." });
    }
    put("settings", job);
    return { job: jobView(job), connections: socialConnections() };
  } finally { locks.bakingSocialJobs!.delete(id); }
}
