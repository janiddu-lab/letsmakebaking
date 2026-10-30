import { describe, it, expect } from "vitest";
import { publicDemoAllows, collectionIsConfigured, publicCollectionAuthorized, requestHostAllowed } from "../lib/public-demo";
describe("공유용 공개 데모", () => {
  it("Render 공개 Host를 허용하고 임의 도메인과 내부 바인딩 주소는 차단한다", () => {
    const origin = "https://letsmakebaking.onrender.com";
    expect(requestHostAllowed("letsmakebaking.onrender.com", true, origin)).toBe(true);
    expect(requestHostAllowed("evil.example", true, origin)).toBe(false);
    expect(requestHostAllowed("0.0.0.0:10000", true, origin)).toBe(false);
    expect(requestHostAllowed("letsmakebaking.onrender.com", false, origin)).toBe(false);
    expect(requestHostAllowed("localhost:3210", false)).toBe(true);
    expect(requestHostAllowed(null, true, origin)).toBe(false);
    expect(requestHostAllowed("evil.example@localhost", false)).toBe(false);
  });
  it.each(["bootstrap", "health", "recipes/shortbread", "features/social"])("읽기 허용: %s", (key) => expect(publicDemoAllows(key, "GET")).toBe(true));
  it.each(["matches", "calculations", "features/pan", "features/autopsy"])("계산·진단 허용: %s", (key) => expect(publicDemoAllows(key, "POST")).toBe(true));
  it.each(["admin/content", "export", "uploads/private-image", "ai/chat", "features/social/start", "state/pantry", "profiles", "import/confirm"])("기록·관리·외부 호출 차단: %s", (key) => {
    expect(publicDemoAllows(key, "POST")).toBe(false);
    expect(publicDemoAllows(key, "GET")).toBe(false);
  });
  it("삭제·수정 동작을 차단한다", () => {
    expect(publicDemoAllows("recipes/shortbread", "DELETE")).toBe(false);
    expect(publicDemoAllows("bootstrap", "PATCH")).toBe(false);
  });
  it("수집이 켜져 있고 충분한 길이의 코드가 설정되어야 한다", () => {
    expect(collectionIsConfigured("true", "fixture-collection-code")).toBe(true);
    expect(collectionIsConfigured("false", "fixture-collection-code")).toBe(false);
    expect(collectionIsConfigured("true", "short")).toBe(false);
  });
  it("올바른 접근 코드로 수집 시작·재개만 허용한다", () => {
    for (const route of ["features/social/start", "features/social/step"])
      expect(publicCollectionAuthorized(route, "POST", "fixture-collection-code", "true", "fixture-collection-code")).toBe(true);
    expect(publicCollectionAuthorized("admin/content", "POST", "fixture-collection-code", "true", "fixture-collection-code")).toBe(false);
  });
  it("잘못된 코드·코드 없음·기능 꺼짐은 수집을 허용하지 않는다", () => {
    expect(publicCollectionAuthorized("features/social/start", "POST", "wrong", "true", "fixture-collection-code")).toBe(false);
    expect(publicCollectionAuthorized("features/social/start", "POST", "", "true", "fixture-collection-code")).toBe(false);
    expect(publicCollectionAuthorized("features/social/start", "POST", "fixture-collection-code", "false", "fixture-collection-code")).toBe(false);
  });
});
