import { AppError, type Recipe } from "./types";

// 아래 값은 교육용 규칙입니다. 제조 실험으로 검증한 확률·물성 예측 모델이 아닙니다.
export const scienceSources = {
  cookies: "https://www.kingarthurbaking.com/learn/cookies",
  chemistry:
    "https://www.kingarthurbaking.com/blog/2016/03/14/cookie-chemistry-2",
  chill:
    "https://www.kingarthurbaking.com/blog/2015/05/17/chilling-cookie-dough",
  oven: "https://www.kingarthurbaking.com/recipes/resources/recipe-success-guide",
  humidity:
    "https://www.kingarthurbaking.com/blog/2018/05/17/meringue-rules?page=0",
};
export const symptoms = [
  ["spread", "쿠키가 퍼졌어요", "cookie"],
  ["hard", "쿠키가 너무 딱딱해요", "cookie"],
  ["collapsed", "케이크가 푹 꺼졌어요", "cake"],
  ["dense-cake", "케이크가 무겁고 떡졌어요", "cake"],
  ["dense-bread", "빵이 돌덩이처럼 무거워요", "bread"],
  ["no-rise", "빵이 부풀지 않았어요", "bread"],
] as const;
export const evidenceQuestions = [
  ["warm", "버터·반죽이 따뜻했나요?"],
  ["no-chill", "냉장 휴지를 생략했나요?"],
  ["low-flour", "밀가루를 눈대중으로 적게 넣었나요?"],
  ["early-door", "굽기 초반에 문을 열었나요?"],
  ["underbaked", "원래 시간보다 일찍 꺼냈나요?"],
  ["long-bake", "시간을 넘기거나 진한 색까지 구웠나요?"],
  ["overmix", "가루를 넣은 뒤 오래 섞었나요?"],
  ["weak-yeast", "이스트 활성을 확인하지 않았나요?"],
  ["short-proof", "부풀기 전에 성형·굽기를 했나요?"],
  ["overproof", "발효 후 표면이 꺼지거나 힘이 없었나요?"],
] as const;
const causes: Record<
  string,
  {
    title: string;
    facts: string[];
    why: string;
    action: string;
    source: string;
  }[]
> = {
  spread: [
    {
      title: "따뜻해진 지방과 반죽",
      facts: ["warm", "no-chill"],
      why: "구조가 잡히기 전에 지방이 녹으면 퍼짐에 영향을 줄 수 있어요.",
      action:
        "같은 배합을 유지하고 냉장 휴지 유무만 바꿔 시험 쿠키를 구워보세요.",
      source: scienceSources.chill,
    },
    {
      title: "밀가루 계량 차이",
      facts: ["low-flour"],
      why: "구조를 만드는 가루가 적으면 배합의 균형이 달라져요.",
      action: "다음에는 원문 중량대로 계량하고 실제 사용한 g을 기록하세요.",
      source: scienceSources.cookies,
    },
    {
      title: "팬·예열·굽기 환경",
      facts: ["underbaked"],
      why: "차가운 오븐이나 팬 표면도 퍼짐에 관여해요.",
      action: "독립 온도계로 예열을 확인하고 팬 조건을 기록하세요.",
      source: scienceSources.oven,
    },
  ],
  hard: [
    {
      title: "과도한 건조",
      facts: ["long-bake"],
      why: "시간과 굽기 상태에 따라 수분이 줄어들어요.",
      action: "원래 권장 범위 안에서 조금 이른 시점부터 상태를 관찰하세요.",
      source: scienceSources.chemistry,
    },
    {
      title: "배합·혼합 방식 차이",
      facts: ["overmix"],
      why: "가루 혼합과 당·지방 비율은 식감에 영향을 줘요.",
      action:
        "재료는 그대로 두고 가루가 보이지 않는 시점에 혼합을 멈춰 비교하세요.",
      source: scienceSources.cookies,
    },
  ],
  collapsed: [
    {
      title: "내부 구조가 잡히기 전 온도 변화",
      facts: ["early-door", "underbaked"],
      why: "외관의 색만으로 내부 구조가 완성되었는지 알 수 없어요.",
      action:
        "원문의 익음 확인법과 권장 범위를 확인하고 초반 문 열기를 피하세요.",
      source: scienceSources.oven,
    },
    {
      title: "혼합·팽창 조건의 차이",
      facts: ["overmix"],
      why: "혼합과 팽창제의 종류·양이 원문과 다르면 부풀기와 지지가 달라져요.",
      action: "배합과 팽창제의 유통·보관 상태를 원문과 대조하세요.",
      source: scienceSources.oven,
    },
  ],
  "dense-cake": [
    {
      title: "가루 혼합과 기포 손실",
      facts: ["overmix"],
      why: "가루를 오래 섞거나 기포를 잃으면 무거운 결과가 나올 수 있어요.",
      action: "혼합 시간과 도구를 기록하고 한 조건만 줄여 비교하세요.",
      source: scienceSources.oven,
    },
    {
      title: "굽기 부족 또는 배합량 차이",
      facts: ["underbaked", "low-flour"],
      why: "내부 수분·구조는 시간, 틀 깊이, 배합량을 함께 봐야 해요.",
      action: "팬 크기와 충전 높이를 확인하고 원문의 완료 기준을 사용하세요.",
      source: scienceSources.oven,
    },
  ],
  "dense-bread": [
    {
      title: "발효가 충분하지 않았을 가능성",
      facts: ["short-proof", "weak-yeast"],
      why: "시간만 재기보다 반죽의 부피와 상태를 같이 관찰해야 해요.",
      action: "다음에는 반죽 온도와 부피 변화 사진을 남겨보세요.",
      source: scienceSources.oven,
    },
    {
      title: "과발효로 지지력이 약해진 경우",
      facts: ["overproof"],
      why: "덜 발효한 반죽과 지나치게 발효한 반죽 모두 무겁게 보일 수 있어요.",
      action: "성형 전후 표면·탄력·부피를 기록해 두 후보를 구분하세요.",
      source: scienceSources.oven,
    },
    {
      title: "물·가루의 계량 차이",
      facts: ["low-flour"],
      why: "가루 종류와 수분 비율이 반죽 상태를 바꿔요.",
      action: "물과 가루를 같은 저울로 계량하고 원문과 비교하세요.",
      source: scienceSources.oven,
    },
  ],
  "no-rise": [
    {
      title: "이스트 상태와 반죽 온도",
      facts: ["weak-yeast"],
      why: "이스트 종류·보관과 반죽 온도를 알아야 원인을 좁힐 수 있어요.",
      action: "제품 설명에 따라 활성을 확인하고 반죽 온도를 기록하세요.",
      source: scienceSources.oven,
    },
    {
      title: "발효 시간·환경 부족",
      facts: ["short-proof"],
      why: "원문의 시간은 특정 환경에서의 참고치예요.",
      action: "타이머뿐 아니라 부피와 탄력의 변화도 비교하세요.",
      source: scienceSources.oven,
    },
  ],
};
export function autopsy(symptom: string, facts: Record<string, string>) {
  if (!causes[symptom])
    throw new AppError("INVALID_SYMPTOM", "실패 결과를 선택해 주세요.");
  return causes[symptom]
    .map((cause, index) => {
      const matched = cause.facts.filter((f) => facts[f] === "yes");
      const contradicted = cause.facts.filter((f) => facts[f] === "no");
      return {
        ...cause,
        score: Math.max(0, 2 + matched.length * 3 - contradicted.length * 2),
        matched,
        unanswered: cause.facts.filter(
          (f) => !facts[f] || facts[f] === "unknown",
        ),
        order: index,
      };
    })
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((cause, index) => ({
      ...cause,
      rank: index + 1,
      label: cause.matched.length
        ? "관찰 근거 있음"
        : cause.unanswered.length
          ? "추가 확인 필요"
          : "현재 관찰과 덜 일치",
    }));
}
export function cookieChemistry(butter: number, sugar: number, soda: number) {
  for (const value of [butter, sugar, soda])
    if (!Number.isFinite(value) || Math.abs(value) > 30)
      throw new AppError(
        "INVALID_CHANGE",
        "원본 대비 -30~30% 범위에서 살펴보세요.",
      );
  const bound = (n: number) => Math.max(-1, Math.min(1, n));
  return {
    spread: bound((butter * 0.6 + sugar * 0.5 + soda * 0.15) / 30),
    chew: bound((butter * 0.25 + sugar * 0.2) / 30),
    crisp: bound((sugar * 0.5 + butter * 0.25) / 30),
    color: bound((sugar * 0.35 + soda * 0.65) / 30),
    note: "화살표와 모양은 방향을 이해하는 설명용 지표입니다. 색·지름·완성도를 수치로 예측하지 않습니다.",
  };
}
export type ThermometerReading = {
  setpoint: number;
  measured: number;
  position: string;
  at?: string;
};
export function ovenCalibration(
  readings: ThermometerReading[],
  target: number,
) {
  const relevant = readings.filter(
    (r) =>
      Number.isFinite(r.setpoint) &&
      Number.isFinite(r.measured) &&
      r.setpoint >= 80 &&
      r.setpoint <= 260 &&
      r.measured >= 50 &&
      r.measured <= 300 &&
      Math.abs(r.setpoint - target) <= 20,
  );
  if (relevant.length < 3)
    return {
      ready: false,
      count: relevant.length,
      offset: null,
      suggested: null,
      note: "목표와 가까운 설정 온도에서 안정된 온도계 측정 3회가 필요해요. 갈변 사진만으로 °C 편차를 알 수는 없어요.",
    };
  const offsets = relevant
    .map((r) => r.measured - r.setpoint)
    .sort((a, b) => a - b);
  const mid = Math.floor(offsets.length / 2);
  const median =
    offsets.length % 2 ? offsets[mid] : (offsets[mid - 1] + offsets[mid]) / 2;
  const spread = Math.max(...offsets) - Math.min(...offsets);
  const ready = Math.abs(median) <= 30 && spread <= 20;
  return {
    ready,
    count: relevant.length,
    offset: Math.round(median * 10) / 10,
    suggested: ready ? Math.round(target - median) : null,
    note: ready
      ? "실측 편차의 중앙값을 이용한 설정 제안이에요. 기기 설명서와 결과를 함께 확인하세요."
      : "측정 편차가 커서 자동 적용을 보류해요. 위치와 예열·측정 시간을 다시 확인하세요.",
  };
}
export type PanSpec = {
  shape: "round" | "rect" | "muffin";
  width: number;
  length?: number;
  depth: number;
  count: number;
};
export function panVolume(p: PanSpec) {
  if (
    !["round", "rect", "muffin"].includes(p.shape) ||
    ![p.width, p.depth, p.count].every((v) => Number.isFinite(v) && v > 0) ||
    !Number.isInteger(p.count) ||
    p.count > 100
  )
    throw new AppError("INVALID_PAN", "팬의 내부 치수와 개수를 확인해 주세요.");
  if (
    p.shape === "rect" &&
    (!p.length || !Number.isFinite(p.length) || p.length <= 0)
  )
    throw new AppError("INVALID_PAN", "사각 팬의 세로 길이를 입력하세요.");
  return (
    (p.shape === "rect" ? p.width * p.length! : Math.PI * (p.width / 2) ** 2) *
    p.depth *
    p.count
  );
}
export function panPlan(original: PanSpec, target: PanSpec, minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600)
    throw new AppError("INVALID_TIME", "원래 굽기 시간을 확인해 주세요.");
  const factor = panVolume(target) / panVolume(original);
  const changed =
    target.shape === "muffin" || Math.abs(target.depth - original.depth) > 0.25;
  return {
    factor: Math.round(factor * 10000) / 10000,
    originalVolume: panVolume(original),
    targetVolume: panVolume(target),
    checkFrom: Math.max(1, Math.floor(minutes * (changed ? 0.6 : 0.8))),
    checkUntil: Math.max(1, Math.floor(minutes * 0.9)),
    note: "깊이는 팬 높이가 아닌 계획한 반죽 충전 높이입니다. 위 시간은 첫 관찰 구간을 일찍 알리는 휴리스틱이며 완성 시간 환산이 아닙니다. 실제 익음은 원문의 기준으로 확인하세요.",
  };
}
export function weatherAdvice(temperature: number, humidity: number) {
  if (
    !Number.isFinite(temperature) ||
    temperature < -30 ||
    temperature > 55 ||
    !Number.isFinite(humidity) ||
    humidity < 0 ||
    humidity > 100
  )
    throw new AppError("INVALID_WEATHER", "온도와 상대습도를 확인해 주세요.");
  const tips: string[] = [];
  if (temperature >= 27)
    tips.push(
      "따뜻한 환경에서는 버터·반죽의 실제 상태를 먼저 확인하고, 너무 무르면 소분해 냉장 상태를 회복하세요.",
    );
  if (humidity >= 70)
    tips.push(
      "습한 환경에서는 머랭·아이싱의 건조와 보관을 특히 관찰하세요. 제습 상태를 확인하고 파운드·브라우니 등 다른 메뉴도 살펴볼 수 있어요.",
    );
  if (temperature < 18)
    tips.push(
      "차가운 환경의 발효는 원문 시간보다 반죽의 부피·탄력 변화를 함께 확인하세요.",
    );
  if (!tips.length)
    tips.push(
      "온습도만으로 성공을 판단하지 마세요. 반죽 온도와 원문의 상태 기준을 함께 기록해 보세요.",
    );
  return {
    tips,
    thresholdNote:
      "27°C·70%는 안내 분기를 위한 편집 기준이며 검증된 실패 경계값이 아닙니다.",
    source: scienceSources.humidity,
  };
}
export function summarizeTwins(rows: any[], protocolKey: string) {
  const valid = rows.filter(
    (r) =>
      r.kind === "twin-experiment" &&
      r.shared &&
      r.controlled &&
      r.protocolKey === protocolKey &&
      r.aDiameter > 0 &&
      r.bDiameter > 0 &&
      r.aThickness > 0 &&
      r.bThickness > 0,
  );
  const grouped = new Map<string, number[]>();
  for (const row of valid) {
    const key = `${row.profileId}:${row.ovenId}`;
    const delta = ((row.bDiameter - row.aDiameter) / row.aDiameter) * 100;
    grouped.set(key, [...(grouped.get(key) ?? []), delta]);
  }
  const perOven = [...grouped.values()].map(
    (values) => values.reduce((a, b) => a + b, 0) / values.length,
  );
  return {
    trials: valid.length,
    ovens: grouped.size,
    participants: new Set(valid.map((r) => r.profileId)).size,
    meanChange: perOven.length
      ? Math.round((perOven.reduce((a, b) => a + b, 0) / perOven.length) * 10) /
        10
      : null,
    notice:
      "이 로컬 프로그램에서 같은 배합·변수·조건으로 기록한 자료만 집계합니다. 전국 표본이나 인과 효과 검증이 아닙니다. 오븐별 평균에 같은 가중치를 줍니다.",
  };
}
export function bakeStage(category: string, progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.2)
    return {
      title: "반죽이 열을 받아요",
      text: "가열이 시작되며 지방·반죽 상태가 변할 수 있어요. 아직 문을 열어 확인할 때로 단정하지 않아요.",
    };
  if (p < 0.5)
    return {
      title:
        category === "bread" ? "부풀기와 구조 변화" : "퍼짐·부풀기를 관찰해요",
      text: "배합과 온도에 따라 일어나는 시점은 달라져요. 화면의 변화는 설명용 애니메이션입니다.",
    };
  if (p < 0.8)
    return {
      title: "모양이 잡히는 구간",
      text: "가능하면 문을 닫은 채 색과 부피를 관찰하세요. 케이크는 특히 원문의 문 열기 주의점을 확인하세요.",
    };
  return {
    title: "완료 기준을 확인할 시간",
    text: "색은 한 가지 단서일 뿐이에요. 레시피의 내부 익음·촉감 등 완료 기준을 함께 확인하세요.",
  };
}
