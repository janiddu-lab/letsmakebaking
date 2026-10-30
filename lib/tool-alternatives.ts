import type { Catalog } from "./types";
export type ToolAlternative = { id: string; name: string; targetIds: string[]; when: string; steps: string[]; limit: string; link?: string; source?: string };
// 대체 도구의 이름·사용 순서·안 되는 용도를 함께 보여줍니다. 내열 조건은 임의로 바꾸지 않습니다.
const methods: Record<string, string[]> = {
  "rolling-pin:bottle": ["용기의 표면·입구에 깨짐이나 날카로운 부분이 없는지 확인하고 깨끗하게 씻어 말립니다.", "원문의 두께 기준을 옆에 놓고 가운데에서 바깥으로 같은 압력으로 밉니다."],
  "scraper:spatula": ["주걱을 볼 곡면에 붙여 반죽을 가운데로 모읍니다.", "단단한 반죽을 자르는 작업에는 쓰지 않습니다."],
  "scraper:knife": ["안정된 도마 위에 반죽을 놓고 자를 위치를 표시합니다.", "손을 날에서 떼고 칼을 수직으로 눌러 나눕니다."],
  "cookie-cutter:paper-template": ["도안을 출력해 원하는 윤곽대로 오립니다.", "차갑게 편 반죽 위에 가이드를 놓고 식품용 칼로 가장자리를 따라 자릅니다.", "종이를 완전히 제거한 반죽만 팬에 옮겨 굽습니다."],
  "cookie-cutter:knife": ["반죽을 같은 두께로 편 뒤 도마 위에서 간격을 표시합니다.", "칼로 사각형이나 마름모로 잘라 서로 간격을 두고 팬에 놓습니다."],
  "piping-bag:zip-bag": ["식품용 지퍼백에 차가운 내용물을 소량 넣고 윗부분을 잠급니다.", "모서리를 아주 조금 자르고 접시에 시험한 뒤 짭니다."],
  "piping-tip:zip-bag": ["식품용 지퍼백 모서리를 아주 작게 자릅니다.", "접시에 점·선을 먼저 짜서 구멍 크기와 누르는 힘을 확인합니다."],
  "offset-spatula:spoon": ["소량의 크림을 가운데에 놓습니다.", "숟가락 뒷면으로 안쪽에서 바깥쪽으로 가볍게 펴 바릅니다."],
  "cake-turntable:plate": ["평평한 접시를 미끄러지지 않는 안정된 작업대에 놓습니다.", "장식을 멈춘 상태에서 접시를 조금씩 손으로 돌리고 다시 장식합니다."],
  "stand-mixer:bowl": ["손반죽이 가능한 소량 레시피를 선택해 볼 안에서 반죽을 모읍니다.", "원문의 휴지와 반죽 상태 기준에 맞춰 손으로 접고 누릅니다."],
  "hand-mixer:whisk": ["거품기와 차가운 크림을 준비해 소량부터 시작합니다.", "중간에 상태를 보며 휘핑하고 필요한 농도에 도달하면 멈춥니다."],
  "whisk:fork": ["달걀이나 소량 액체를 넓은 그릇에 담습니다.", "포크로 노른자를 풀고 덩어리가 고르게 섞일 때까지 저어줍니다."],
  "sieve:whisk": ["큰 덩어리가 없는 가루를 마른 볼에 넣습니다.", "거품기로 고르게 섞으며 작은 뭉침을 풀어줍니다."],
  "measuring-cup:scale": ["용기를 올리고 저울을 영점으로 맞춥니다.", "원문에 g이 있으면 그 값을 재고, 부피만 있다면 재료별 환산 근거를 확인합니다."],
  "measuring-spoon:scale": ["저울의 최소 표시 단위와 필요한 분량을 비교합니다.", "해당 재료의 질량 환산 근거가 있고 저울이 그 양을 구분할 때만 계량합니다."],
  "brush:spoon": ["우유나 달걀물을 숟가락으로 소량 뜹니다.", "숟가락 뒷면으로 아주 얇게 펴 바르고 한곳에 고이지 않았는지 확인합니다."],
  "parchment:silicone-mat": ["식품·오븐용 표시와 허용 온도를 확인합니다.", "팬에 평평하게 놓고 원문의 익음 기준을 보며 바닥색과 퍼짐을 확인합니다."],
  "round-pan:pan": ["흐르지 않고 자유 성형이 가능한 쿠키 반죽인지 확인합니다.", "팬 위에 같은 두께로 나눠 놓고 시험 조각으로 상태를 확인합니다."],
  "loaf-pan:pan": ["틀 없이도 성형이 가능한 빵 반죽인지 원문을 확인합니다.", "안정된 모양으로 성형하고 식빵틀의 높이 대신 새 형태와 중심 익음 기준으로 관찰합니다."],
  "piping-bag:spoon": ["원문이 드롭 쿠키처럼 떠 놓는 방식을 허용하는지 확인합니다.", "같은 크기·중량으로 떠서 팬에 놓고 간격을 맞춥니다."],
};
export function toolAlternatives(id: string, catalog: Catalog): ToolAlternative[] {
  const rows: ToolAlternative[] = catalog.substitutions.filter(r => r.kind === "equipment" && r.fromId === id).map(rule => ({ id: rule.id, name: rule.to.map(t => catalog.equipment.find(e => e.id === t.id)?.name ?? t.id).join(" + "), targetIds: rule.to.map(t => t.id), when: rule.conditions.split(" · 적용 전에")[0], steps: methods[`${id}:${rule.to[0]?.id}`] ?? [rule.changes], limit: rule.limits, link: rule.to.some(t => t.id === "paper-template") ? "/learn?type=template" : ["measuring-cup", "measuring-spoon"].includes(id) ? "/calculator?tab=unit" : undefined }));
  if (id === "cookie-cutter") rows.unshift({ id: "cutter-cup", name: "식품용 컵의 둥근 입구", targetIds: ["cup"], when: "동그란 모양을 만들 수 있는 차가운 쿠키 반죽", steps: ["입구가 매끈하고 깨짐이 없는 컵을 씻어 말립니다.", "입구를 반죽에 가볍게 눌러 원형으로 잘라냅니다. 잘 안 잘리면 억지로 힘을 주지 않습니다.", "컵은 치우고 잘라낸 반죽만 팬에 올립니다."], limit: "별·꽃 모양은 만들 수 없어요. 컵을 반죽과 함께 오븐에 넣지 않습니다.", source: "https://www.landolakes.com/expert-advice/no-cookie-cutter-no-problem/" });
  return rows;
}
