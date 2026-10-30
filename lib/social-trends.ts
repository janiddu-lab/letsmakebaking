import { all, put } from "./db";
import { AppError } from "./types";
import { crawlYoutube, crawlInstagram } from "./public-social";
import { productNames } from "./trend-products";
import { isBakingRelated, bakingHashtags } from "./baking-relevance";

export type SocialPost = {
  id: string;
  platform: string;
  author: string;
  text: string;
  url: string;
  publishedAt: string;
  timePrecision?: "exact" | "relative" | "day";
  timeLabel?: string;
  timeRangeStart?: string;
  timeRangeEnd?: string;
};
export function kstDayWindow(now = new Date()) {
  const day = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  return {
    day,
    since: new Date(`${day}T00:00:00+09:00`).toISOString(),
    until: now.toISOString(),
  };
}
// 한 게시물에서 같은 말을 반복해도 한 번만 세고, 같은 내용의 재게시도 중복 제거합니다.
export function summarizeSocial(
  posts: SocialPost[],
  since: string,
  until: string,
) {
  const seen = new Set<string>();
  const unique = posts.filter((p) => {
    const time = Date.parse(p.publishedAt);
    if (
      !Number.isFinite(time) ||
      time < Date.parse(since) ||
      time > Date.parse(until)
      || !isBakingRelated(p.text)
      || (p.timeRangeStart && Date.parse(p.timeRangeStart) < Date.parse(since))
      || (p.timeRangeEnd && Date.parse(p.timeRangeEnd) > Date.parse(until))
    )
      return false;
    const hash = p.text
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\s+/g, "")
      .slice(0, 500);
    if (!hash || seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });
  const map = new Map<
    string,
    {
      keyword: string;
      postIds: Set<string>;
      authors: Set<string>;
      platforms: Set<string>;
    }
  >();
  const hashtagMap = new Map<string, { keyword: string; postIds: Set<string>; authors: Set<string>; platforms: Set<string> }>();
  const candidateMap = new Map<string, { keyword: string; postIds: Set<string>; authors: Set<string>; platforms: Set<string> }>();
  const addWords = (target: typeof map, words: Iterable<string>, post: SocialPost) => {
    for (const word of words) {
      const row = target.get(word) ?? { keyword: word, postIds: new Set<string>(), authors: new Set<string>(), platforms: new Set<string>() };
      row.postIds.add(post.id);
      if (post.author && !post.author.startsWith("unknown:")) row.authors.add(`${post.platform}:${post.author}`);
      row.platforms.add(post.platform);
      target.set(word, row);
    }
  };
  for (const post of unique) {
    const text = post.text.toLowerCase();
    const names = productNames(post.text);
    addWords(map, names.products, post);
    addWords(candidateMap, names.candidates, post);
    addWords(hashtagMap, bakingHashtags(text), post);
  }
  const ranked = (values: typeof map) => [...values.values()].map((r) => ({ keyword: r.keyword, count: r.postIds.size, authors: r.authors.size, platforms: [...r.platforms], postIds: [...r.postIds] }))
    .sort((a, b) => b.count - a.count || b.authors - a.authors || a.keyword.localeCompare(b.keyword)).slice(0, 30);
  return {
    posts: unique,
    keywords: ranked(map),
    hashtags: ranked(hashtagMap),
    productCandidates: ranked(candidateMap),
    analysisVersion: 2,
    authors: new Set(unique.filter((p) => p.author && !p.author.startsWith("unknown:")).map((p) => `${p.platform}:${p.author}`)).size,
  };
}
async function jsonFetch(url: string, headers?: Record<string, string>) {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(12000),
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok) {
    const reason = response.status === 403
      ? "접근이 거부됐어요(403). 서비스의 공개 검색 제한을 확인해 주세요."
      : response.status === 401
        ? "인증이 필요해요(401). 계정 권한과 API 설정을 확인해 주세요."
        : response.status === 429
          ? "조회 한도에 도달했어요(429). 잠시 후 다시 시도해 주세요."
          : `외부 서비스 조회 오류(${response.status})`;
    throw new Error(reason);
  }
  const raw = await response.text();
  if (raw.length > 3_000_000) throw new Error("응답 크기 제한");
  return JSON.parse(raw);
}

export async function blueskyPage(query: string, since: string, until: string, cursor?: string) {
  const params = new URLSearchParams({ q: query, sort: "latest", since, until, limit: "100", ...(cursor ? { cursor } : {}) });
  const body = await jsonFetch(`https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?${params}`);
  const posts: SocialPost[] = (body.posts ?? []).flatMap((p: any) => {
    const rkey = String(p.uri ?? "").split("/").at(-1), author = p.author?.did;
    if (!author || !rkey) return [];
    return [{ id: p.uri, platform: "bluesky", author: p.author.handle ?? author, text: String(p.record?.text ?? "").slice(0, 1500), publishedAt: p.record?.createdAt ?? p.indexedAt, url: `https://bsky.app/profile/${encodeURIComponent(author)}/post/${encodeURIComponent(rkey)}` }];
  });
  return { posts, cursor: typeof body.cursor === "string" ? body.cursor : undefined };
}
export function socialConnections() {
  return [
    {
      id: "bluesky",
      name: "Bluesky",
      configured: true,
      note: "키 없이 공식 AppView에서 공개 게시물을 검색합니다. 서비스 제한 시 실패할 수 있어요.",
    },
    {
      id: "youtube",
      name: "YouTube",
      configured: true,
      note: "API 키 없이 공개 검색 HTML 수집 · 상대 공개 시각은 추정으로 표시",
    },
    {
      id: "instagram",
      name: "Instagram",
      configured: true,
      note: "API 키 없이 공개 HTML 수집 시도 · 로그인·공개 데이터 미제공 시 수집 불가",
    },
  ];
}
export async function collectSocial(platforms: string[], instagramUrls: string[] = []) {
  const window = kstDayWindow();
  const recent = all("settings")
    .filter((s) => s.kind === "social-trend-run")
    .at(-1);
  // 성공한 수집은 1분, 전부 실패한 수집은 10초 후 재시도할 수 있습니다.
  const interval = recent?.status === "failed" ? 10000 : 60000;
  if (recent && Date.now() - Date.parse(recent.collectedAt) < interval)
    throw new AppError(
      "COLLECTION_INTERVAL",
      `약 ${Math.ceil((interval - (Date.now() - Date.parse(recent.collectedAt))) / 1000)}초 후 다시 수집해 주세요.`,
    );
  const supported = socialConnections();
  if (
    !platforms.length ||
    platforms.some((p) => !supported.some((s) => s.id === p))
  )
    throw new AppError("INVALID_SOURCE", "수집할 SNS를 선택해 주세요.");
  const posts: SocialPost[] = [];
  const errors: string[] = [];
  const notes: string[] = [];
  const succeeded: string[] = [];
  for (const platform of platforms) {
    try {
      if (!supported.find((s) => s.id === platform)?.configured)
        throw new Error("연결 설정 필요");
      if (platform === "bluesky") {
        // 검색은 비캐시 공식 AppView를 사용합니다. public.api의 검색 주소는 403을 반환할 수 있습니다.
        const queries = await Promise.allSettled(["베이킹", "홈베이킹", "baking"].map(async (q) => {
          const params = new URLSearchParams({
            q,
            sort: "latest",
            since: window.since,
            until: window.until,
            limit: "100",
          });
          const j = await jsonFetch(
            `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?${params}`,
          );
          for (const p of j.posts ?? []) {
            const rkey = String(p.uri).split("/").at(-1);
            const author = p.author?.did;
            if (!author || !rkey) continue;
            posts.push({
              id: p.uri,
              platform,
              author: p.author.handle ?? author,
              text: String(p.record?.text ?? "").slice(0, 1500),
              publishedAt: p.record?.createdAt ?? p.indexedAt,
              url: `https://bsky.app/profile/${encodeURIComponent(author)}/post/${encodeURIComponent(rkey)}`,
            });
          }
        }));
        const failures = queries.filter((r) => r.status === "rejected");
        if (failures.length === queries.length)
          throw (failures[0] as PromiseRejectedResult).reason;
        if (failures.length)
          errors.push(`Bluesky: 검색어 ${failures.length}개의 조회에 실패했어요. 성공한 검색 결과만 집계합니다.`);
      }
      if (platform === "youtube") {
        const result = await crawlYoutube(window.since, window.until);
        posts.push(...result.posts);
        notes.push(...result.warnings);
      }
      if (platform === "instagram") {
        const result = await crawlInstagram(instagramUrls);
        posts.push(...result.posts);
        notes.push(...result.warnings);
      }
      succeeded.push(platform);
    } catch (e) {
      errors.push(
        `${supported.find((s) => s.id === platform)?.name}: ${e instanceof Error ? e.message : "수집 실패"}`,
      );
    }
  }
  const summary = summarizeSocial(posts, window.since, window.until);
  const result = {
    kind: "social-trend-run",
    ...window,
    collectedAt: new Date().toISOString(),
    retryAfter: new Date(Date.now() + (succeeded.length ? 60000 : 10000)).toISOString(),
    ...summary,
    status: succeeded.length
      ? errors.length
        ? "partial"
        : "completed"
      : "failed",
    errors,
    notes,
    platforms: succeeded,
    requestedPlatforms: platforms,
    notice:
      "KST 오늘 범위에서 조회한 SNS 표본입니다. YouTube 공개 페이지의 상대 시각은 오차 범위 전체가 오늘일 때만 포함한 추정값입니다. 전체 SNS 인기 순위가 아니며 알 수 없는 작성자는 작성자 수에서 제외합니다.",
  };
  // Instagram 해시태그 API는 작성자 정보를 제공하지 않을 수 있어 수를 꾸며내지 않습니다.
  result.authors = new Set(
    summary.posts
      .filter((p) => !p.author.startsWith("unknown:"))
      .map((p) => `${p.platform}:${p.author}`),
  ).size;
  result.keywords = result.keywords
    .map((row) => ({
      ...row,
      authors: new Set(
        summary.posts
          .filter(
            (p) =>
              row.postIds.includes(p.id) && !p.author.startsWith("unknown:"),
          )
          .map((p) => `${p.platform}:${p.author}`),
      ).size,
    }))
    .sort((a, b) => b.count - a.count || b.authors - a.authors);
  return put("settings", result);
}
export function latestSocial() {
  const saved = all("settings").filter((s) => s.kind === "social-trend-run").at(-1);
  let run = null;
  if (saved) {
    const todaySince = saved.todaySince ?? kstDayWindow(new Date(saved.until)).since;
    const posts: SocialPost[] = saved.posts ?? [];
    const dayPosts = posts.filter((p) => Date.parse(p.publishedAt) >= Date.parse(todaySince)
      && ((!p.timePrecision || p.timePrecision === "exact") || (p.timeRangeStart && Date.parse(p.timeRangeStart) >= Date.parse(todaySince))));
    const summary = summarizeSocial(posts, saved.since, saved.until);
    run = { ...saved, status: saved.status, instagramObserved: (saved.instagramObserved ?? []).filter((p: SocialPost) => isBakingRelated(p.text)), day: String(saved.day), targetReached: saved.target ? summary.posts.length >= saved.target : undefined,
      filteredOut: posts.length - summary.posts.length, ...summary, todaySince,
      today: summarizeSocial(dayPosts, todaySince, saved.until), isStale: saved.day !== kstDayWindow().day };
  }
  return {
    // 날짜가 바뀌어도 마지막 결과를 숨기지 않고, 이전 날짜 자료임을 화면에 표시합니다.
    run,
    connections: socialConnections(),
  };
}
