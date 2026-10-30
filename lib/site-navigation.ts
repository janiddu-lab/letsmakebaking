import type { Catalog } from "./types";
import { translateCore } from "./locale";
export type SiteAction = { id: string; title: string; description: string; href: string };
const tools = [
  { id: "tool:cup", title: "내 컵 등록하기", description: "컵 용량을 확인하고 계량 기준으로 저장해요.", href: "/learn/basic-volume", pattern: /종이컵|머그|계량컵|컵.{0,8}(용량|계량|몇|크기|ml)|내컵/ },
  { id: "tool:unit", title: "단위 환산하기", description: "재료별 g·ml·컵·숟가락 환산을 확인해요.", href: "/calculator?tab=unit", pattern: /단위|환산|그램|밀리리터|큰술|작은술|몇g|스푼|숟가락/ },
  { id: "tool:autopsy", title: "실패 역추적 시작하기", description: "증상과 관찰 단서로 원인 후보를 좁혀요.", href: "/autopsy", pattern: /실패|망했|망친|퍼졌|퍼지|퍼짐|꺼졌|가라앉|돌덩이|딱딱|안부풀|안익|덜익|탔어|탄쿠키/ },
  { id: "tool:pan", title: "내 팬 크기로 바꾸기", description: "원형·사각·머핀 팬의 배합량을 비교해요.", href: "/science?tab=pan", pattern: /팬.{0,8}(크기|변환|환산|사각|원형)|틀.{0,8}(크기|변환|환산)|머핀틀|사각틀|원형틀/ },
  { id: "tool:cost", title: "원가 계산하기", description: "내 구매 가격으로 사용 원가와 추가 지출을 구분해요.", href: "/calculator?tab=cost", pattern: /원가|비용|얼마|재료비|가격계산|포장비/ },
  { id: "tool:shopping", title: "여러 메뉴 장보기", description: "선택한 레시피의 공통 재료를 합산해요.", href: "/calculator?tab=shopping", pattern: /장보기|장볼|구매목록|여러메뉴|부족한재료/ },
  { id: "tool:oven", title: "우리 집 오븐 기록하기", description: "측정 온도와 열 쏠림을 기록해요.", href: "/science?tab=oven", pattern: /오븐.{0,8}(편차|보정|성격|온도)|열쏠림|예열/ },
  { id: "tool:weather", title: "날씨와 반죽 확인하기", description: "도시 날씨와 실내 온습도에 맞는 관찰 팁을 봐요.", href: "/science?tab=weather", pattern: /습도|습한|날씨|기온|더운날|추운날|온습도/ },
  { id: "tool:chemistry", title: "쿠키 화학 실험하기", description: "버터·설탕 변화의 경향을 슬라이더로 비교해요.", href: "/science?tab=chemistry", pattern: /쿠키화학|슬라이더|쫀득|바삭|버터.{0,8}(늘리|줄이|많이)|설탕.{0,8}(늘리|줄이|적게)/ },
  { id: "tool:lab", title: "재료·도구 대체 찾기", description: "레시피에 적용할 수 있는 대체 조건을 비교해요.", href: "/lab", pattern: /대체|대신|도구가없|도구없이|버터없이|달걀없이|계란없이/ },
  { id: "tool:discover", title: "내 재료로 레시피 찾기", description: "사이트에 있는 레시피를 재료와 도구 조건으로 찾아요.", href: "/discover", pattern: /추천|레시피찾|뭘만들|무엇을만들|가진재료|있는재료/ },
  { id: "tool:trends", title: "오늘의 트렌드 보기", description: "수집된 제품명과 근거 SNS 게시물을 살펴봐요.", href: "/trends", pattern: /트렌드|유행|인기디저트|두쫀쿠|버터떡|sns|인스타/ },
  { id: "tool:twins", title: "쌍둥이 베이킹 기록하기", description: "한 조건만 다르게 만든 A·B 결과를 비교해요.", href: "/science?tab=twins", pattern: /쌍둥이|비교실험|집단실험|a.?b실험/ },
  { id: "tool:journal", title: "베이킹 기록 남기기", description: "시도와 결과를 남기고 다음 베이킹과 비교해요.", href: "/journal", pattern: /일지|기록|메모|베이킹노트/ },
  { id: "tool:icing", title: "아이싱 방법 찾아보기", description: "아이싱 농도와 선·면 채우기 안내를 읽어요.", href: "/learn/icing-consistency", pattern: /아이싱|깍지|면채우기|선그리기/ },
];
const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const translatedKeywords: Record<string, RegExp> = {
  "tool:cup": /measuringcup|mycup|cupvolume|cupsize|mug|カップの容量|計量カップ|マイカップ/,
  "tool:unit": /convert|conversion|measurement|tablespoon|teaspoon|単位|換算|大さじ|小さじ/,
  "tool:autopsy": /failed|failure|cookiesspread|cakesank|collapsedcake|hardbread|wentwrong|失敗|クッキーが広|しぼん|固いパン/,
  "tool:pan": /pansize|changepan|roundpan|squarepan|muffintin|型のサイズ|丸型|角型|マフィン型/,
  "tool:cost": /cost|price|expense|原価|費用|材料費|値段/,
  "tool:shopping": /shopping|grocery|買い物|購入リスト/,
  "tool:oven": /oventemperature|ovencalibration|preheat|オーブン温度|温度差|予熱/,
  "tool:weather": /humidity|weather|roomtemperature|湿度|天気|室温/,
  "tool:chemistry": /cookiechemistry|chewy|crispy|クッキーの科学|サクサク|しっとり/,
  "tool:lab": /substitut|replacement|alternative|代用|置き換え/,
  "tool:discover": /findrecipe|recommendrecipe|whattobake|recipewith|レシピを探|おすすめ|何を作/,
  "tool:trends": /trend|trending|トレンド|流行/,
  "tool:twins": /twinbake|compareexperiment|比較実験/,
  "tool:journal": /journal|bakingnote|記録|メモ/,
  "tool:icing": /icing|piping|アイシング|絞り/,
};

// 모델이 주소를 만들지 않게, 실제 서비스 주소와 현재 카탈로그에서만 이동 대상을 만듭니다.
export function siteActions(question: string, catalog: Catalog): SiteAction[] {
  const q = normalize(question);
  if (q.length < 2) return [];
  const matches = tools.filter(t => t.pattern.test(q) || translatedKeywords[t.id]?.test(q)).map(({ pattern, ...action }) => action);
  const recipes = catalog.recipes.filter(r => [r.title, translateCore(r.title, "en"), translateCore(r.title, "ja")].some(title => normalize(title).length > 2 && q.includes(normalize(title)))).map(r => ({ id: `recipe:${r.id}`, title: r.title, description: "재료·준비·만들기 순서를 확인해요.", href: `/recipes/${encodeURIComponent(r.id)}` }));
  const articles = catalog.articles.filter(a => normalize(a.title).length > 3 && q.includes(normalize(a.title))).map(a => ({ id: `article:${a.id}`, title: a.title, description: a.summary, href: `/learn/${encodeURIComponent(a.id)}` }));
  return [...recipes, ...matches, ...articles].filter((a, i, all) => all.findIndex(b => b.href === a.href) === i).slice(0, 4);
}
export function resolveSiteActions(ids: string[], candidates: SiteAction[]) {
  const selected = ids.map(id => candidates.find(a => a.id === id)).filter((a): a is SiteAction => !!a);
  return [...selected, ...candidates].filter((a, i, all) => all.findIndex(b => b.href === a.href) === i).slice(0, 3);
}
