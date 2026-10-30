// 개인 계정·키·쿠키는 담지 않습니다. 공개 페이지 수집 장면만 메모리에 잠시 보관합니다.
export type LiveEvent = { at: string; stage: string; message: string; platform?: string; query?: string; url?: string; caption?: string; publishedAt?: string; included?: boolean };
export type LiveFrame = { image: string; url: string; capturedAt: string };
export type CollectionLive = { jobId: string; revision: number; events: LiveEvent[]; updatedAt: string; frame?: LiveFrame; frames?: LiveFrame[]; frameCount?: number; state: "running" | "finished" };
const shared = globalThis as unknown as { bakingCollectionLive?: Map<string, CollectionLive> };
shared.bakingCollectionLive ??= new Map();
export function liveUrl(value?: string) {
  if (!value) return undefined;
  try { const u = new URL(value); if (u.protocol !== "https:" || u.username || u.password || !["www.instagram.com", "instagram.com", "www.youtube.com", "bsky.app", "public.api.bsky.app"].includes(u.hostname)) return undefined; return u.origin + u.pathname; } catch { return undefined; }
}
export function emitCollectionLive(jobId: string, event: Omit<LiveEvent, "at">, image?: string) {
  const now = new Date().toISOString();
  for (const [id, value] of shared.bakingCollectionLive!) if (Date.now() - Date.parse(value.updatedAt) > 2 * 3600000) shared.bakingCollectionLive!.delete(id);
  const value: CollectionLive = shared.bakingCollectionLive!.get(jobId) ?? { jobId, revision: 0, events: [], updatedAt: now, state: "running" };
  const row: LiveEvent = { at: now, stage: event.stage.slice(0, 40), message: event.message.slice(0, 250), platform: event.platform?.slice(0, 25), query: event.query?.slice(0, 50), url: liveUrl(event.url), caption: event.caption?.slice(0, 180), publishedAt: event.publishedAt, included: event.included };
  value.events = [...value.events, row].slice(-36); value.updatedAt = now; value.revision++;
  if (event.stage === "done") value.state = "finished";
  if (image && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image) && image.length <= 350000 && row.url) {
    value.frame = { image, url: row.url, capturedAt: now };
    value.frames = [...(value.frames ?? []), value.frame].slice(-8);
  }
  shared.bakingCollectionLive!.set(jobId, value);
  while (shared.bakingCollectionLive!.size > 4) shared.bakingCollectionLive!.delete(shared.bakingCollectionLive!.keys().next().value!);
}
export function readCollectionLive(jobId: string, after?: number, includeFrames = false) {
  const value = shared.bakingCollectionLive!.get(jobId);
  if (!value || Date.now() - Date.parse(value.updatedAt) > 2 * 3600000) return { live: null };
  if (after === value.revision) return { unchanged: true, revision: value.revision, state: value.state };
  const { frames, ...current } = value;
  return { live: { ...current, frameCount: frames?.length ?? 0, ...(includeFrames ? { frames } : {}) } };
}
export type CollectionObserver = (event: Omit<LiveEvent, "at">, image?: string) => void;
