import type { SocialPost } from "./social-trends";

// 공개 HTML만 읽습니다. 로그인 쿠키·비공개 API·CAPTCHA 우회를 사용하지 않습니다.
export async function publicHtml(input: string): Promise<string> {
  let url = new URL(input);
  const allowed = new Set(["www.youtube.com", "www.instagram.com", "instagram.com"]);
  for (let hops = 0; hops < 4; hops++) {
    if (url.protocol !== "https:" || !allowed.has(url.hostname) || url.port || url.username || url.password)
      throw new Error("허용된 SNS의 공개 HTTPS 주소만 읽을 수 있어요.");
    const response = await fetch(url, {
      headers: { "User-Agent": "BakingLabLocal/1.0", "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7" },
      signal: AbortSignal.timeout(15000), redirect: "manual", cache: "no-store",
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("SNS의 이동 주소를 확인할 수 없어요.");
      url = new URL(location, url);
      if (/\/accounts\/login|\/challenge|\/consent|\/sorry/.test(url.pathname))
        throw new Error("SNS가 로그인·동의·접근 확인 화면을 반환했어요. 공개 수집을 중단합니다.");
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`공개 페이지 접근 실패(${response.status}). 로그인·요청 제한 상태일 수 있어요.`);
    }
    if (!response.headers.get("content-type")?.includes("text/html")) {
      await response.body?.cancel();
      throw new Error("공개 HTML 응답이 아니에요.");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("페이지 본문이 없어요.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 6_000_000) throw new Error("공개 페이지 크기 제한(6MB)을 넘었어요.");
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("SNS 페이지가 너무 여러 번 이동했어요.");
}

// script를 실행하지 않고 JSON 객체의 문자열·괄호 경계만 읽습니다.
export function assignedJson(html: string, marker: string): any | null {
  const index = html.indexOf(marker);
  if (index < 0) return null;
  const start = html.indexOf("{", index + marker.length);
  if (start < 0 || start - index > 100) return null;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

function walk(root: any, visit: (v: any) => void) {
  const stack = [root];
  let remaining = 60000;
  while (stack.length && remaining-- > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    visit(node);
    for (const value of Object.values(node)) if (value && typeof value === "object") stack.push(value);
  }
}
const textOf = (node: any) => node?.simpleText ?? node?.runs?.map((r: any) => r.text ?? "").join("") ?? "";

// ‘3시간 전’은 정확한 공개 시각이 아닙니다. 반올림 범위 전체가 오늘에 들어올 때만 채택합니다.
export function relativePublished(label: string, since: string, until: string) {
  const match = label.match(/(\d+)\s*(초|분|시간|일|second|minute|hour|day)s?\s*(전|ago)/i);
  if (!match) return null;
  const units: Record<string, number> = { 초: 1000, 분: 60000, 시간: 3600000, 일: 86400000, second: 1000, minute: 60000, hour: 3600000, day: 86400000 };
  const unit = units[match[2].toLowerCase()];
  const n = Number(match[1]);
  const upper = Date.parse(until) - n * unit;
  const lower = upper - unit;
  if (lower < Date.parse(since)) return null;
  return { publishedAt: new Date((lower + upper) / 2).toISOString(), timeRangeStart: new Date(lower).toISOString(), timeLabel: label, timePrecision: "relative" as const };
}

export function parseYoutube(html: string, since: string, until: string): SocialPost[] {
  const initial = assignedJson(html, "var ytInitialData =") ?? assignedJson(html, 'window["ytInitialData"] =');
  if (!initial) throw new Error("YouTube 검색 데이터가 없어요. 접근 확인 화면이거나 페이지 형식이 바뀌었을 수 있어요.");
  const found = new Map<string, SocialPost>();
  walk(initial, (node) => {
    const video = node.videoRenderer;
    if (!video || !/^[\w-]{11}$/.test(video.videoId ?? "")) return;
    const timing = relativePublished(textOf(video.publishedTimeText), since, until);
    if (!timing) return;
    const authorRuns = video.ownerText?.runs ?? video.longBylineText?.runs ?? [];
    const author = authorRuns[0]?.navigationEndpoint?.browseEndpoint?.browseId ?? authorRuns[0]?.text ?? `unknown:${video.videoId}`;
    const snippet = video.detailedMetadataSnippets?.map((s: any) => textOf(s.snippetText)).join(" ") ?? "";
    found.set(video.videoId, {
      id: `youtube:${video.videoId}`, platform: "youtube", author,
      text: (textOf(video.title) + " " + snippet).slice(0, 1500),
      url: `https://www.youtube.com/watch?v=${video.videoId}`, ...timing,
    });
  });
  return [...found.values()];
}

function decodeHtml(s: string) {
  return s.replace(/&#x([0-9a-f]+);/gi, (_, n) => { const code = parseInt(n, 16); return code <= 0x10ffff ? String.fromCodePoint(code) : ""; })
    .replace(/&#(\d+);/g, (_, n) => Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : "")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function meta(html: string, key: string) {
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = Object.fromEntries([...tag[0].matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map((m) => [m[1].toLowerCase(), decodeHtml(m[3])]));
    if (attributes.property === key || attributes.name === key) return attributes.content ?? "";
  }
  return "";
}
export function instagramUrl(input: string) {
  const url = new URL(input);
  if (url.protocol !== "https:" || !["instagram.com", "www.instagram.com"].includes(url.hostname) || url.port || url.username || url.password)
    throw new Error("Instagram 공개 게시물 주소를 넣어 주세요.");
  const path = url.pathname.match(/^\/(p|reel)\/([\w-]{3,100})\/?$/);
  if (!path) throw new Error("Instagram /p/ 또는 /reel/ 게시물 주소만 추가할 수 있어요.");
  return `https://www.instagram.com/${path[1]}/${path[2]}/`;
}

export function parseInstagram(html: string, source: string): SocialPost[] {
  const found = new Map<string, SocialPost>();
  const add = (code: any, text: any, date: any, author: any) => {
    if (!/^[\w-]{3,100}$/.test(String(code ?? "")) || typeof text !== "string" || !text.trim()) return;
    const value = typeof date === "number" ? new Date(date * 1000).toISOString() : String(date ?? "");
    // 날짜만 있고 시간대가 없는 문자열은 오늘 게시물로 단정하지 않습니다.
    if (!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) return;
    found.set(code, { id: `instagram:${code}`, platform: "instagram", author: String(author || `unknown:${code}`), text: decodeHtml(text).slice(0, 1500), publishedAt: value, url: `https://www.instagram.com/p/${code}/`, timePrecision: "exact" });
  };
  const roots: any[] = [];
  for (const script of html.matchAll(/<script\b[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { roots.push(JSON.parse(script[1])); } catch { /* JSON이 아닌 스크립트는 실행하지 않고 건너뜁니다. */ }
  }
  const shared = assignedJson(html, "window._sharedData =");
  if (shared) roots.push(shared);
  for (const root of roots) walk(root, (node) => {
    const code = node.shortcode ?? node.code;
    const caption = typeof node.caption === "string" ? node.caption : node.caption?.text ?? node.edge_media_to_caption?.edges?.[0]?.node?.text;
    add(code, caption, node.taken_at_timestamp ?? node.taken_at, node.owner?.username ?? node.user?.username);
    if (node["@type"] === "VideoObject" || node["@type"] === "SocialMediaPosting" || node["@type"] === "ImageObject") {
      const url = node.url ?? node.mainEntityOfPage ?? source;
      const match = typeof url === "string" ? url.match(/\/(?:p|reel)\/([\w-]+)/) : null;
      add(match?.[1], node.articleBody ?? node.caption ?? node.description ?? node.name, node.datePublished ?? node.uploadDate, typeof node.author === "string" ? node.author : node.author?.name);
    }
  });
  const code = source.match(/\/(?:p|reel)\/([\w-]+)/)?.[1];
  if (code) add(code, meta(html, "og:description"), meta(html, "article:published_time"), meta(html, "article:author"));
  // 공개 상세 페이지가 ISO 시각 대신 ‘February 5, 2026’처럼 날짜만 제공하는 경우입니다.
  if (code && !found.has(code)) {
    const description = meta(html, "og:description");
    const match = description.match(/-\s*([\w.]+)\s*-\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4}):\s*["“]([\s\S]*)/i);
    if (match) {
      const month = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(match[2].toLowerCase());
      const start = Date.UTC(Number(match[4]), month, Number(match[3]));
      const date = new Date(start);
      if (date.getUTCMonth() === month && date.getUTCDate() === Number(match[3])) {
        found.set(code, { id: `instagram:${code}`, platform: "instagram", author: match[1],
          text: match[5].replace(/["”]\.??\s*$/, "").slice(0, 1500), url: source,
          publishedAt: new Date(start + 12 * 3600000).toISOString(), timePrecision: "day", timeLabel: date.toISOString().slice(0, 10),
          // 표시 날짜의 시간대가 명시되지 않아 UTC-12~UTC+14 전체 오차 범위를 보관합니다.
          timeRangeStart: new Date(start - 14 * 3600000).toISOString(), timeRangeEnd: new Date(start + 36 * 3600000).toISOString() });
      }
    }
  }
  return [...found.values()];
}

export async function crawlYoutube(since: string, until: string) {
  const results = await Promise.allSettled(["베이킹", "홈베이킹", "baking"].map(async (query) => {
    const params = new URLSearchParams({ search_query: query, sp: "EgIIAg==" });
    return parseYoutube(await publicHtml(`https://www.youtube.com/results?${params}`), since, until);
  }));
  const good = results.filter((r): r is PromiseFulfilledResult<SocialPost[]> => r.status === "fulfilled");
  if (!good.length) throw (results[0] as PromiseRejectedResult).reason;
  return { posts: good.flatMap((r) => r.value), warnings: good.length < results.length ? ["YouTube 일부 검색어의 공개 페이지를 읽지 못해 성공한 결과만 집계해요."] : [] };
}

export async function crawlYoutubeQuery(query: string, since: string, until: string) {
  // 주간 업로드 필터입니다. 실제 집계 범위는 파서에서 다시 검사합니다.
  const params = new URLSearchParams({ search_query: query, sp: "EgIIAw==" });
  return parseYoutube(await publicHtml(`https://www.youtube.com/results?${params}`), since, until);
}

export async function crawlInstagram(urls: string[] = [], query = "베이킹") {
  const targets = [...new Set(urls.map(instagramUrl))].slice(0, 8);
  if (!targets.length) targets.push(`https://www.instagram.com/explore/tags/${encodeURIComponent(query)}/`);
  const results = await Promise.allSettled(targets.map(async (url) => parseInstagram(await publicHtml(url), url)));
  const posts = results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
  if (!posts.length) {
    const { renderInstagram } = await import("./instagram-renderer");
    return renderInstagram(query, urls);
  }
  return { posts, warnings: results.some((r) => r.status === "rejected" || !r.value.length) ? ["Instagram 일부 페이지는 공개 데이터가 없어 제외했어요."] : [] };
}
