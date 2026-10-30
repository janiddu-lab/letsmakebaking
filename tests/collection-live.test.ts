import { describe, it, expect } from "vitest";
import { emitCollectionLive, readCollectionLive, liveUrl } from "../lib/collection-live";
describe("실제 크롤링 시연 기록", () => {
  it("메시지·공개 주소·실제 JPEG 프레임만 기록한다", () => {
    emitCollectionLive("one", { stage: "browser", message: "공개 페이지", url: "https://www.instagram.com/p/ABC/" }, "data:image/jpeg;base64,AA==");
    const result = readCollectionLive("one").live!;
    expect(result.frame?.url).toContain("/p/ABC/"); expect(result.frameCount).toBe(1); expect(result.frames).toBeUndefined();
  });
  it("API 키·임의 HTML·외부 호스트를 프레임 주소로 노출하지 않는다", () => {
    expect(liveUrl("https://user:secret@www.instagram.com/p/x/")).toBeUndefined(); expect(liveUrl("javascript:alert(1)")).toBeUndefined(); expect(liveUrl("https://evil.test/")).toBeUndefined();
    expect(liveUrl("https://www.instagram.com/p/x/?token=secret")).toBe("https://www.instagram.com/p/x/");
  });
  it("다시보기는 최대 8개 장면이며 요청했을 때만 반환한다", () => {
    for (let i = 0; i < 12; i++) emitCollectionLive("two", { stage: "browser", message: String(i), url: `https://www.instagram.com/p/${i}/` }, "data:image/jpeg;base64,AA==");
    expect(readCollectionLive("two", undefined, true).live?.frames).toHaveLength(8);
    expect(readCollectionLive("two").live?.frames).toBeUndefined();
  });
  it("끝난 실행은 완료 상태를 유지하고 같은 버전은 프레임을 재전송하지 않는다", () => {
    emitCollectionLive("three", { stage: "done", message: "실제 조회 완료" });
    const result = readCollectionLive("three").live!;
    expect(readCollectionLive("three", result.revision)).toMatchObject({ unchanged: true, state: "finished" });
    expect(readCollectionLive("unknown")).toEqual({ live: null });
  });
});
