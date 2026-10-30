import type { Recipe } from "./types";
import { weatherAdvice } from "./science";
export type WeatherTask = "recipe" | "icing";
export type WeatherStep = { id: string; title: string; prepare: string; check: string; next: string; href: string; action: string; source: string };
// 온습도 구간은 안내를 고르는 편집 기준입니다. 배합량·온도·시간을 예측해 바꾸지 않습니다.
export function weatherPlan(recipe: Recipe | null, temperature: number, humidity: number, task: WeatherTask = "recipe") {
  weatherAdvice(temperature, humidity);
  const hot = temperature >= 27, cold = temperature < 18, humid = humidity >= 70;
  const ingredients = new Set(recipe?.ingredients.map(i => i.id));
  const yeast = ingredients.has("yeast") || ingredients.has("yeast-active");
  const butter = ingredients.has("butter-unsalted") || ingredients.has("butter-salted");
  const steps: WeatherStep[] = [];
  if (task === "icing") steps.push({ id: "dry", title: humid ? "건조와 포장 전에 한 번 더 확인" : "시간보다 표면 상태를 확인", prepare: "작업 공간의 제습·환기 상태와 식힘 공간을 먼저 확인하세요. 머랭과 아이싱은 원문의 건조·보관 방법을 따릅니다.", check: "시험 조각으로 표면의 끈적임·묻어남을 확인하고, 안쪽까지 마른지는 원문 기준으로 확인하세요.", next: humid ? "덜 말랐다면 포장을 미루고 건조 상태를 다시 관찰하세요. 온도·습도만 보고 건조 시간을 정하지 마세요." : "표면이 말랐더라도 바로 밀폐하지 말고 원문의 식힘·포장 기준을 확인하세요.", href: "/learn/icing-consistency", action: "아이싱 농도·건조 가이드", source: "https://www.kingarthurbaking.com/blog/2018/05/17/meringue-rules?page=0" });
  else if (yeast) steps.push({ id: "proof", title: cold ? "차가운 주방에서는 발효 상태를 먼저" : hot ? "따뜻한 주방에서는 부풀기를 자주 확인" : "발효의 끝을 부피·촉감으로 판단", prepare: "용기에 시작 높이를 표시하고 덮개로 표면 건조를 막으세요. 원문이 지정한 반죽 온도와 발효 상태를 확인합니다.", check: "시작 높이와 현재 부피·기포·탄력을 비교하세요. 모든 빵이 두 배까지 부푸는 것은 아니므로 원문 기준을 우선합니다.", next: cold ? "덜 부풀었다면 원문이 허용하는 환경에서 더 관찰하세요. 높은 열을 직접 가하거나 시간을 일괄 배수로 늘리지 마세요." : "원문의 상태에 도달하면 다음 단계로 진행하세요. 날씨만으로 물·이스트 양을 바꾸지 않습니다.", href: "/learn/basic-proof", action: "발효 관찰 방법 보기", source: "https://www.kingarthurbaking.com/blog/2023/03/23/ask-the-bread-coach-my-dough-isnt-rising-what-now" });
  else if (recipe?.category === "cookie" && butter) steps.push({ id: "cookie", title: hot ? "성형 중 반죽이 물러지는지 확인" : "원문의 버터 상태와 반죽 단단함 확인", prepare: hot ? "성형할 양만 나눠 꺼내고, 다음 팬은 차가운 상태로 준비하세요. 녹인 버터를 쓰는 배합도 원문의 냉장·휴지 지시를 우선합니다." : "버터를 차갑게·부드럽게·녹여 쓰는지는 레시피마다 달라요. 이 레시피의 시작 상태와 휴지 단계를 먼저 읽으세요.", check: "잡을 때 기름이 묻어나거나 모양이 무너지는지, 팬 위에서 굽기 전부터 퍼지는지 살펴보세요.", next: "원문보다 물러졌다면 덮어서 냉장 상태를 회복한 뒤 시험 조각을 구워 비교하세요. 밀가루를 임의로 더 넣지 않습니다.", href: "/learn/shape-cookie", action: "쿠키 성형 상태 확인", source: "https://www.quakeroats.com/cooking-and-recipes/baking-101/cookies/mixing-cookie-dough" });
  else if (recipe?.category === "scone") steps.push({ id: "scone", title: hot ? "차가운 재료와 짧은 작업 동선 준비" : "스콘 반죽은 원문의 차가운 상태 유지", prepare: "차갑게 쓰도록 지정된 재료와 팬을 먼저 준비하고, 재료를 꺼낸 뒤 작업 순서가 끊기지 않도록 정리하세요.", check: "반죽이 번들거리거나 지방이 손에 과하게 묻는지 확인하고, 원문의 질감·섞는 횟수 기준을 보세요.", next: "원문보다 지나치게 물러졌다면 덮어서 차갑게 회복시킨 뒤 작업하세요. 오래 치대거나 가루로 덮어 해결하지 마세요.", href: "/recipes/" + recipe.id, action: "이 레시피 공정 확인", source: "https://www.kingarthurbaking.com/recipes/resources/recipe-success-guide" });
  else if (recipe) steps.push({ id: "recipe", title: hot && butter ? "버터 상태를 맞춘 뒤 섞기" : "이 메뉴는 원문의 상태 기준으로 준비", prepare: hot && butter ? "부드러운 버터를 쓰는 배합이라도 액체처럼 녹으면 같은 상태가 아닙니다. 원문이 지정한 버터와 달걀의 상태를 먼저 맞추세요." : "계량·팬·재료 상태를 먼저 확인하세요. 이 메뉴에는 온습도만으로 바꿀 수 있는 검증된 배합 보정값이 없습니다.", check: "원문의 반죽·섞임·완료 기준과 지금 상태를 대조하세요. 실외 기온으로 오븐 온도를 바꾸지 않습니다.", next: "원문대로 시작하고 이상이 있다면 상태와 진행 시점을 기록하세요. 물·가루·굽는 시간을 자동 조정하지 않습니다.", href: "/recipes/" + recipe.id, action: "재료와 원문 공정 확인", source: "https://www.kingarthurbaking.com/recipes/resources/recipe-success-guide" });
  if (recipe || task === "icing") steps.push({ id: "finish", title: humid ? "습한 날은 식힘과 포장을 분리" : "완전히 식힌 뒤 포장 상태 확인", prepare: "원문이 허용하는 식힘 공간과 보관 용기를 준비하세요. 냉장 보관이 필요한 제품은 원문의 보관 조건을 따릅니다.", check: "제품의 남은 열과 포장 안쪽의 물방울·표면 끈적임을 확인하세요.", next: "열과 수증기가 남아 있다면 성급하게 밀폐하지 말고, 충분히 식힌 뒤 원문 조건에 맞게 보관하세요.", href: "/learn/basic-cool", action: "식힘·포장 가이드", source: "https://www.kingarthurbaking.com/recipes/resources/recipe-success-guide" });
  return { hot, cold, humid, steps, summary: [hot ? "따뜻한 작업 환경" : cold ? "차가운 작업 환경" : "중간 온도 구간", humid ? "높은 습도 구간" : "습도에 따른 추가 경고 없음"].join(" · ") };
}
export function weatherCandidates(recipes: Recipe[], temperature: number, humidity: number) {
  weatherAdvice(temperature, humidity);
  // 발효·버터 작업·건조 공정의 관리 부담만 비교합니다. 재료 보유·알레르기·성공률 추천이 아닙니다.
  return recipes.filter(r => r.tested || ["FORMULA_REVIEWED", "SOURCE_COMPARED"].includes(r.evidence)).map(recipe => {
    const ids = recipe.ingredients.map(i => i.id), yeast = ids.some(id => id === "yeast" || id === "yeast-active");
    const butter = ids.some(id => id.startsWith("butter-"));
    const dry = /머랭|아이싱/.test(recipe.title + recipe.steps.map(s => s.text).join(" "));
    let score = 0;
    const reasons: string[] = [];
    if (temperature >= 27 && !butter) { score += 3; reasons.push("버터 성형 관리가 덜 필요한 배합"); }
    if (temperature < 18 && !yeast) { score += 3; reasons.push("이스트 발효 기다림이 없는 메뉴"); }
    if (humidity >= 70 && !dry && recipe.category === "cake") { score += 3; reasons.push("머랭·아이싱의 표면 건조를 주공정으로 삼지 않는 메뉴"); }
    if (!yeast) score++;
    if (!reasons.length) reasons.push("온습도보다 원문 공정과 도구를 보고 고를 수 있는 메뉴");
    return { recipe, reasons, score };
  }).sort((a, b) => b.score - a.score || a.recipe.totalMin - b.recipe.totalMin).slice(0, 3);
}
