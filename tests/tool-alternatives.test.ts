import { describe, it, expect } from "vitest";
import catalog from "../content/catalog.json";
import type { Catalog } from "../lib/types";
import { toolAlternatives } from "../lib/tool-alternatives";
const c = catalog as Catalog;
describe("집에 있는 것으로 바꾸는 구체적 도구 안내", () => {
  it("쿠키커터는 컵·종이도안·칼과 각각의 사용법을 보여준다", () => {
    const options = toolAlternatives("cookie-cutter", c);
    expect(options.map(o => o.targetIds[0])).toEqual(expect.arrayContaining(["cup", "paper-template", "knife"]));
    expect(options.every(o => o.steps.length >= 2 && !!o.when && !!o.limit)).toBe(true);
  });
  it("종이와 컵을 오븐에 넣지 않도록 구분한다", () => {
    const options = toolAlternatives("cookie-cutter", c);
    expect(options.find(o => o.targetIds.includes("cup"))?.limit).toContain("오븐에 넣지");
    expect(options.find(o => o.targetIds.includes("paper-template"))?.steps.join(" ")).toContain("종이를 완전히 제거");
  });
  it("대체 대상은 실제 도구 사전에 있고 사용 단계가 비어 있지 않다", () => {
    for (const e of c.equipment) for (const option of toolAlternatives(e.id, c)) { expect(option.targetIds.every(id => c.equipment.some(t => t.id === id))).toBe(true); expect(option.steps.length).toBeGreaterThan(0); }
  });
  it("검토하지 않은 오븐 대체를 임의로 만들지 않는다", () => expect(toolAlternatives("oven", c)).toEqual([]));
});
