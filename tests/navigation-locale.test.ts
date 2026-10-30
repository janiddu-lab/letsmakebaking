import { describe, expect, it } from "vitest";
import catalogData from "../content/catalog.json";
import type { Catalog } from "../lib/types";
import { siteActions, resolveSiteActions, replyNavigation } from "../lib/site-navigation";
import { asLanguage, matchesLocalized, translateCore } from "../lib/locale";
import { knownPublicTexts, filterPublicTranslationTexts } from "../lib/public-translation-texts";
import { validateTranslationRows } from "../lib/translations";
import { geminiRequest, parseGeminiReply } from "../lib/gemini";
const catalog = catalogData as Catalog;
describe("AI 질문에서 실제 내부 페이지로 연결", () => {
  it.each(["휘낭시에 어떻게 만드는지 알려줘", "휘낭시에 어떻게 만들어?", "피낭시에 만드는 법", "how to make financiers", "フィナンシェの作り方"])('%s는 등록된 휘낭시에 레시피로 연결한다', question => {
    expect(siteActions(question, catalog)[0].href).toBe("/recipes/financier");
  });
  it("짧은 메뉴명과 만드는 법 질문도 레시피를 찾는다", () => {
    expect(siteActions("쇼트브레드 만드는 법", catalog)[0].href).toBe("/recipes/shortbread");
    expect(siteActions("파운드케이크 어떻게 만들어", catalog).some(a => a.href.startsWith("/recipes/"))).toBe(true);
  });
  it("답변에 실제로 참조한 문서만 확인창 대상으로 쓴다", () => {
    expect(replyNavigation("질문", [{ id: "https://evil.invalid" }], catalog)).toBeNull();
    expect(replyNavigation("질문", [{ id: "financier" }], catalog)?.href).toBe("/recipes/financier");
  });
  it("메뉴 만드는 법을 물으면 AI 참고 자료에 실제 배합과 생산량도 제공한다", () => {
    const request = geminiRequest({ message: "휘낭시에 어떻게 만들어", consent: true }, catalog);
    const financier = request.refs.find(ref => ref.id === "financier")!;
    expect(financier.text).toContain("30 g"); expect(financier.text).toContain("55 g"); expect(financier.text).toContain("생산량: 12개");
  });
  it.each([["내 컵 용량은 어떻게 등록해요?", "/learn/basic-volume"], ["쿠키가 퍼졌어요", "/autopsy"], ["내 사각 팬 크기로 환산", "/science?tab=pan"], ["원가 계산하고 싶어", "/calculator?tab=cost"]])("%s → %s", (question, href) => {
    expect(siteActions(question, catalog).some(a => a.href === href)).toBe(true);
  });
  it("영어·일본어 질문과 번역된 레시피 제목을 찾는다", () => {
    expect(siteActions("How do I measure my cup volume?", catalog)[0].href).toBe("/learn/basic-volume");
    expect(siteActions("カップの容量を登録したい", catalog)[0].href).toBe("/learn/basic-volume");
    expect(siteActions("Butter shortbread recipe", catalog)[0].href).toBe("/recipes/shortbread");
  });
  it("관련 없는 질문에는 임의의 페이지를 추천하지 않는다", () => expect(siteActions("내일 주식 가격을 알려줘", catalog).some(a => a.href === "/admin")).toBe(false));
  it("모델이 임의 주소나 운영자 ID를 보내도 등록된 후보만 렌더링한다", () => {
    const candidates = siteActions("내 컵 용량", catalog);
    const result = resolveSiteActions(["https://evil.invalid", "admin", "tool:cup"], candidates);
    expect(result).toHaveLength(1); expect(result[0].href).toBe("/learn/basic-volume");
  });
  it("Gemini 답변에도 검증한 이동 카드를 붙인다", () => {
    const request = geminiRequest({ message: "쿠키가 퍼졌어요", consent: true, language: "en" }, catalog);
    expect(request.payload.messages[0].content).toContain("English");
    const reply = parseGeminiReply({ choices: [{ message: { content: JSON.stringify({ answer: "Check the dough temperature.", sourceIds: [], questions: [], uncertainties: [], actionIds: ["tool:autopsy"] }) } }] }, request.refs, request.actions);
    expect(reply.actions[0].href).toBe("/autopsy");
  });
});
describe("언어 선택과 공개 콘텐츠 번역", () => {
  it.each(["쿠키커터가 없으면 어떡해", "쿠키 커터가 없어요", "쿠키틀 대신 뭘 쓸까"])('%s 질문은 실제 도구 대체 안내를 찾는다', question => {
    const actions = siteActions(question, catalog);
    expect(actions.some(a => a.href === "/learn/equipment-cookie-cutter")).toBe(true);
  });
  it("지원 언어만 허용하고 한국어는 원문을 유지한다", () => {
    expect(asLanguage("en")).toBe("en"); expect(asLanguage("ja")).toBe("ja"); expect(asLanguage("unknown")).toBe("ko");
    expect(translateCore("베이킹 계산기", "en")).toBe("Baking calculators");
    expect(translateCore("내 주방", "ja")).toBe("マイキッチン"); expect(translateCore("내 주방", "ko")).toBe("내 주방");
  });
  it("영문 재료·레시피 검색을 지원한다", () => {
    expect(matchesLocalized("중력분", "all-purpose")).toBe(true);
    expect(matchesLocalized("버터 쇼트브레드", "shortbread")).toBe(true);
    expect(matchesLocalized("버터 쇼트브레드", "ショートブレッド")).toBe(true);
  });
  it("개인 메모를 임의 텍스트로 번역 제공자에게 보내지 않는다", () => {
    const known = knownPublicTexts(catalog);
    expect(filterPublicTranslationTexts(["내 주방", "개인 메모: 우리 학교 비밀 식단", "중력분", "내 주방"], known)).toEqual(["내 주방", "중력분"]);
  });
  it("온도·분량의 숫자가 바뀐 번역과 요청하지 않은 항목은 거부한다", () => {
    const result = validateTranslationRows({ translations: [{ source: "160°C로 35분 굽기", target: "Bake at 180°C for 35 minutes" }, { source: "밀가루 120g", target: "Flour 120g" }, { source: "비공개", target: "Private" }] }, ["160°C로 35분 굽기", "밀가루 120g"]);
    expect(result).toEqual({ "밀가루 120g": "Flour 120g" });
  });
});
