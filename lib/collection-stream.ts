import type { Page } from "playwright-core";

type Listener = (frame: Uint8Array | null) => void;
type Channel = { listeners: Set<Listener>; frame?: Uint8Array; updated: number; ended: boolean };
const shared = globalThis as unknown as { bakingBrowserStreams?: Map<string, Channel> };
shared.bakingBrowserStreams ??= new Map();
function channel(id: string) {
  for (const [key, entry] of shared.bakingBrowserStreams!) {
    if (!entry.listeners.size && Date.now() - entry.updated > 120000) shared.bakingBrowserStreams!.delete(key);
  }
  let entry = shared.bakingBrowserStreams!.get(id);
  if (!entry) { entry = { listeners: new Set(), updated: Date.now(), ended: false }; shared.bakingBrowserStreams!.set(id, entry); }
  return entry;
}
// 다시보기나 파일 저장 없이 Chromium이 보내는 현재 화면만 전달합니다.
export function publishBrowserFrame(id: string, frame: Uint8Array) {
  if (!frame.length || frame.length > 350000) return;
  const entry = channel(id);
  entry.frame = frame; entry.updated = Date.now(); entry.ended = false;
  for (const listener of entry.listeners) listener(frame);
}
export function endBrowserStream(id: string) {
  const entry = channel(id);
  entry.ended = true; entry.frame = undefined; entry.updated = Date.now();
  for (const listener of entry.listeners) listener(null);
}
export function subscribeBrowserStream(id: string, listener: Listener) {
  const entry = channel(id);
  if (entry.listeners.size >= 6 || [...shared.bakingBrowserStreams!.values()].reduce((n, row) => n + row.listeners.size, 0) >= 24) throw new Error("STREAM_BUSY");
  entry.listeners.add(listener);
  if (entry.frame) listener(entry.frame);
  if (entry.ended) listener(null);
  return () => { entry.listeners.delete(listener); };
}
export async function streamBrowserPage(page: Page, id: string) {
  const session = await page.context().newCDPSession(page);
  let lastSent = 0;
  // screenshot 반복 호출 대신 브라우저의 실시간 screencast 이벤트를 사용합니다.
  session.on("Page.screencastFrame", ({ data, sessionId }) => {
    void session.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    const url = new URL(page.url());
    if (url.protocol !== "https:" || !["www.instagram.com", "instagram.com"].includes(url.hostname)
      || /\/accounts\/|\/challenge|\/consent|\/sorry/.test(url.pathname) || Date.now() - lastSent < 120) return;
    lastSent = Date.now(); publishBrowserFrame(id, Buffer.from(data, "base64"));
  });
  await session.send("Page.startScreencast", { format: "jpeg", quality: 55, maxWidth: 960, maxHeight: 600, everyNthFrame: 1 });
  return async () => { await session.send("Page.stopScreencast").catch(() => {}); await session.detach().catch(() => {}); };
}
// 한 연결로 연속 프레임을 전달합니다. 느린 연결에는 지난 장면을 쌓지 않습니다.
export function browserStreamResponse(id: string, signal: AbortSignal) {
  const encoder = new TextEncoder();
  let unsubscribe = () => {}, heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false, close = () => {};
  const cleanup = () => { unsubscribe(); clearInterval(heartbeat); signal.removeEventListener("abort", close); };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      close = () => { if (closed) return; closed = true; cleanup(); controller.close(); };
      if (signal.aborted) { close(); return; }
      signal.addEventListener("abort", close, { once: true });
      try {
        unsubscribe = subscribeBrowserStream(id, frame => {
          if (!frame) { close(); return; }
          if (closed || (controller.desiredSize ?? 0) <= 0) return;
          const header = encoder.encode(`--baking-stream\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
          const chunk = new Uint8Array(header.length + frame.length + 2);
          chunk.set(header); chunk.set(frame, header.length); chunk.set([13, 10], header.length + frame.length);
          controller.enqueue(chunk);
        });
        if (closed) { cleanup(); return; }
        heartbeat = setInterval(() => { if (!closed && (controller.desiredSize ?? 0) > 0) controller.enqueue(encoder.encode("\r\n")); }, 10000);
      } catch { close(); }
    },
    cancel() { closed = true; cleanup(); },
  });
  return new Response(stream, { headers: { "Content-Type": "multipart/x-mixed-replace; boundary=baking-stream", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no", "X-Content-Type-Options": "nosniff" } });
}
