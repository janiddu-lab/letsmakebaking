import { describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import { browserStreamResponse, publishBrowserFrame, streamBrowserPage, subscribeBrowserStream, endBrowserStream } from "../lib/collection-stream";

describe("실시간 수집 브라우저 스트림", () => {
  it("HTTP 한 연결에서 서로 다른 새 프레임을 연속 전달하고 접속 종료 시 해제한다", async () => {
    const abort = new AbortController();
    const response = browserStreamResponse("continuous", abort.signal);
    expect(response.headers.get("content-type")).toContain("multipart/x-mixed-replace");
    const reader = response.body!.getReader();
    publishBrowserFrame("continuous", new Uint8Array([255, 216, 1]));
    expect(new TextDecoder().decode((await reader.read()).value)).toContain("Content-Length: 3");
    publishBrowserFrame("continuous", new Uint8Array([255, 216, 2, 3]));
    expect(new TextDecoder().decode((await reader.read()).value)).toContain("Content-Length: 4");
    abort.abort(); expect((await reader.read()).done).toBe(true);
  });
  it("수집이 끝나면 마지막 화면 기록을 남기지 않고 연결을 닫는다", async () => {
    const response = browserStreamResponse("finish", new AbortController().signal);
    const reader = response.body!.getReader(); endBrowserStream("finish");
    expect((await reader.read()).done).toBe(true);
    const listener = vi.fn(); subscribeBrowserStream("finish", listener)();
    expect(listener).toHaveBeenCalledWith(null);
  });
  it("느린 연결에 프레임을 쌓지 않고 너무 큰 화면은 버린다", async () => {
    const response = browserStreamResponse("slow", new AbortController().signal);
    publishBrowserFrame("slow", new Uint8Array([1]));
    publishBrowserFrame("slow", new Uint8Array(350001));
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain("Content-Length: 1");
    await reader.cancel();
  });
  it("Chromium screencast를 사용하고 접근 확인 화면은 전달하지 않으며 모든 프레임을 ACK한다", async () => {
    let receive: (event: { data: string; sessionId: number }) => void = () => {};
    let location = "https://www.instagram.com/challenge/";
    const send = vi.fn(async () => {}), detach = vi.fn(async () => {});
    const session = { on: (_event: string, callback: typeof receive) => { receive = callback; }, send, detach };
    const page = { context: () => ({ newCDPSession: async () => session }), url: () => location } as unknown as Page;
    const listener = vi.fn(), unsubscribe = subscribeBrowserStream("cdp", listener);
    const stop = await streamBrowserPage(page, "cdp");
    expect(send).toHaveBeenCalledWith("Page.startScreencast", expect.objectContaining({ format: "jpeg" }));
    receive({ data: "AA==", sessionId: 1 }); expect(listener).not.toHaveBeenCalled();
    location = "https://www.instagram.com/p/ABC/";
    receive({ data: "AA==", sessionId: 2 }); expect(listener).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("Page.screencastFrameAck", { sessionId: 1 });
    await stop(); unsubscribe(); expect(send).toHaveBeenCalledWith("Page.stopScreencast"); expect(detach).toHaveBeenCalled();
  });
});
