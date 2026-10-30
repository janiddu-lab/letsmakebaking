"use client";
import { useState } from "react";
import Link from "next/link";
import { useLab, api, amount } from "./context";
import { Empty, PageHeading, Tag } from "./ui";
import {
  symptoms,
  evidenceQuestions,
  cookieChemistry,
  ovenCalibration,
  weatherAdvice,
  scienceSources,
  type PanSpec,
} from "@/lib/science";
import type { Recipe } from "@/lib/types";

const tabs = [
  ["autopsy", "실패 역추적 🕵️"],
  ["chemistry", "쿠키 화학 🧪"],
  ["oven", "오븐 성격 🔥"],
  ["pan", "이 팬 어떡해? 🧁"],
  ["weather", "날씨와 반죽 ☁️"],
  ["twins", "쌍둥이 베이킹 🍪"],
  ["models", "내 3D 오브제 🪩"],
];
export function ScienceScreen({ initial = "autopsy" }: { initial?: string }) {
  const [tab, setTab] = useState(initial);
  return (
    <>
      <PageHeading
        eyebrow="MAKE A MESS. LEARN SOMETHING."
        title="망쳐도 괜찮아, 베이킹이니까!"
        description="실패도 데이터, 궁금증도 레시피. 우리 집에서 해보는 작은 과학."
      />
      <div className="science-tab-bar">
        {tabs.map(([id, label]) => (
          <button
            className={tab === id ? "active" : ""}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "autopsy" ? (
        <AutopsyScreen />
      ) : tab === "chemistry" ? (
        <ChemistryScreen />
      ) : tab === "oven" ? (
        <OvenScreen />
      ) : tab === "pan" ? (
        <PanScreen />
      ) : tab === "weather" ? (
        <WeatherScreen />
      ) : tab === "twins" ? (
        <TwinsScreen />
      ) : (
        <ModelManager />
      )}
    </>
  );
}
// 제조 결과의 원인은 여러 가지입니다. 관찰 일치도를 실제 확률처럼 표시하지 않습니다.
function AutopsyScreen() {
  const { boot, act, profileId } = useLab();
  const [symptom, setSymptom] = useState("spread");
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  return (
    <div className="science-sheet">
      <div className="sticker-label">BAKE AUTOPSY / 실패의 해부학</div>
      <h2>무슨 일이 있었나요?</h2>
      <div className="symptom-grid">
        {symptoms.map(([id, label]) => (
          <button
            className={`symptom-card ${symptom === id ? "active" : ""}`}
            key={id}
            onClick={() => {
              setSymptom(id);
              setResult(null);
            }}
          >
            {label}
            <span>↗</span>
          </button>
        ))}
      </div>
      <h3>기억나는 것만 골라주세요.</h3>
      <p className="muted">
        모르는 항목은 그대로 두세요. 단서가 없는 원인을 확정하지 않아요.
      </p>
      <div className="evidence-grid">
        {evidenceQuestions.map(([id, text]) => (
          <label key={id} className="field">
            {text}
            <select
              value={facts[id] ?? "unknown"}
              onChange={(e) => setFacts({ ...facts, [id]: e.target.value })}
            >
              <option value="unknown">잘 모르겠어요</option>
              <option value="yes">네</option>
              <option value="no">아니요</option>
            </select>
          </label>
        ))}
      </div>
      <button
        className="button primary"
        onClick={async () => {
          const r = await act(() =>
            api(`features/autopsy?profileId=${profileId}`, { symptom, facts }),
          );
          if (r) setResult(r);
        }}
      >
        실패를 역추적해 줘 ↗
      </button>
      {result && (
        <section className="autopsy-results">
          <div className="notice">
            관찰에 맞는 원인 후보 순서예요. 통계적 발생 확률이 아니라 확인
            우선순위입니다. 사진·실험 데이터 없이 %를 만들지 않아요.
          </div>
          {result.result.map((r: any) => (
            <article className="cause-card" key={r.title}>
              <span className="cause-rank">{r.rank}</span>
              <div>
                <Tag>{r.label}</Tag>
                <h3>{r.title}</h3>
                <p>{r.why}</p>
                <div className="cause-evidence">
                  일치한 단서 {r.matched.length}개 · 추가 질문{" "}
                  {r.unanswered.length}개
                </div>
                <strong>다음에는 딱 하나만 바꿔봐요</strong>
                <p>{r.action}</p>
                <a href={r.source} target="_blank" rel="noreferrer">
                  참고 원리 ↗
                </a>
              </div>
            </article>
          ))}
          <Link className="button outline" href="/science?tab=twins">
            쌍둥이 실험으로 비교하기
          </Link>
        </section>
      )}
    </div>
  );
}

// 비율 변경은 설명용 경향으로 보여주고 저장한 수정본은 미검증 실험으로 남깁니다.
function ChemistryScreen() {
  const { boot, save } = useLab();
  const cookies = boot!.catalog.recipes.filter((r) => r.category === "cookie");
  const [id, setId] = useState(
    cookies.find((r) => r.ingredients.some((i) => i.id === "baking-soda"))
      ?.id ?? cookies[0].id,
  );
  const [butter, setButter] = useState(0);
  const [sugar, setSugar] = useState(0);
  const [soda, setSoda] = useState(0);
  const recipe = cookies.find((r) => r.id === id)!;
  const hasButter = recipe.ingredients.some((i) => i.id.startsWith("butter-"));
  const hasSoda = recipe.ingredients.some((i) => i.id === "baking-soda");
  const result = cookieChemistry(butter, sugar, hasSoda ? soda : 0);
  const changed = (item: any) =>
    item.id.startsWith("butter-")
      ? butter
      : item.id.startsWith("sugar-")
        ? sugar
        : item.id === "baking-soda"
          ? soda
          : 0;
  const attributes = [
    ["spread", "퍼짐"],
    ["chew", "쫀득함"],
    ["crisp", "바삭함"],
    ["color", "갈변"],
  ] as const;
  return (
    <div className="science-sheet">
      <div className="sticker-label">COOKIE CHEMISTRY CLUB</div>
      <div className="two-column">
        <section>
          <h2>버터를 더 넣으면 어떨까?</h2>
          <label className="field">
            기준 쿠키
            <select
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                setButter(0);
                setSugar(0);
                setSoda(0);
              }}
            >
              {cookies.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
          {[
            ["버터", butter, setButter, !hasButter],
            ["설탕", sugar, setSugar, false],
            ["베이킹소다", soda, setSoda, !hasSoda],
          ].map(([label, value, set, disabled]: any) => (
            <label className="chemistry-control" key={label}>
              <span>
                {label}
                <strong>
                  {Number(value) > 0 ? "+" : ""}
                  {value}%
                </strong>
              </span>
              <input
                aria-label={`${label} 증감`}
                type="range"
                min="-30"
                max="30"
                step="5"
                value={value}
                disabled={disabled}
                onChange={(e) => set(Number(e.target.value))}
              />
              {disabled && (
                <small>원본에 없는 재료는 임의로 추가하지 않아요.</small>
              )}
            </label>
          ))}
          <button
            className="button outline"
            onClick={() => {
              setButter(0);
              setSugar(0);
              setSoda(0);
            }}
          >
            원래 배합으로
          </button>
        </section>
        <section className="cookie-visual">
          <span className="tape-label">NOT A PHOTO, A WHAT-IF!</span>
          <svg
            viewBox="0 0 340 235"
            role="img"
            aria-label="재료 변화 경향을 설명하는 쿠키 그림"
          >
            <ellipse
              cx="170"
              cy="175"
              rx="110"
              ry="18"
              fill="#2b245b"
              opacity=".12"
            />
            <ellipse
              className="chem-cookie"
              cx="170"
              cy="133"
              rx={91 + result.spread * 18}
              ry={66 - result.spread * 12}
              fill={`hsl(${35 - result.color * 7},65%,${62 - result.color * 12}%)`}
              stroke="#332245"
              strokeWidth="4"
            />
            {[
              [-40, -15],
              [25, -25],
              [49, 12],
              [-13, 20],
              [-56, 20],
              [8, -2],
            ].map(([x, y], i) => (
              <path
                key={i}
                d={`M${170 + x} ${133 + y}l9 -4 6 9 -10 7z`}
                fill="#46314b"
              />
            ))}
          </svg>
          <p>원본 대비 변화 방향을 만져보는 그림이에요.</p>
          <div className="chem-attributes">
            {attributes.map(([key, label]) => (
              <div key={key}>
                <span>{label}</span>
                <div className="tendency-track">
                  <i style={{ left: `${50 + result[key] * 40}%` }} />
                </div>
                <strong>
                  {result[key] > 0.1 ? "↑" : result[key] < -0.1 ? "↓" : "≈"}
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="notice">
        {result.note} 원본의 당 종류·지방 상태·산도·공정에 따라 방향이 달라질 수
        있어요. 소다를 늘리면 산도 균형과 맛도 달라지므로 그대로 실행하는
        배합으로 보지 마세요.
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>재료</th>
              <th>원래</th>
              <th>슬라이더 배합</th>
            </tr>
          </thead>
          <tbody>
            {recipe.ingredients.map((i) => (
              <tr key={i.id}>
                <td>
                  {boot!.catalog.ingredients.find((g) => g.id === i.id)?.name}
                </td>
                <td>
                  {amount(i.quantity)} {i.unit}
                </td>
                <td>
                  {amount(i.quantity * (1 + changed(i) / 100))} {i.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="button primary"
        onClick={() =>
          save("versions", {
            recipeId: id,
            label: `${recipe.title} 화학 실험 아이디어`,
            status: "UNVERIFIED_IDEA",
            changes: [
              `버터 ${butter}%, 설탕 ${sugar}%, 소다 ${soda}% · 실행 전 검토 필요`,
            ],
            recipe: {
              ...recipe,
              evidence: "EDITORIAL_CHECKED",
              ingredients: recipe.ingredients.map((i) => ({
                ...i,
                quantity: i.quantity * (1 + changed(i) / 100),
              })),
              steps: [
                {
                  text: "이 수정본은 실험 아이디어이며 원본과 같은 결과를 보장하지 않습니다. 실행 전에 배합을 검토하세요.",
                  advanced: result.note,
                },
                ...recipe.steps,
              ],
            },
          })
        }
      >
        실험 아이디어로 저장
      </button>
      <a
        className="inline-link"
        href={scienceSources.chemistry}
        target="_blank"
        rel="noreferrer"
      >
        쿠키 화학 참고 자료 ↗
      </a>
    </div>
  );
}

export function OvenSuggestion({ recipe }: { recipe: Recipe }) {
  const { boot } = useLab();
  const oven = boot!.user.settings.find((s) => s.kind === "oven-profile");
  const match = recipe.steps
    .map((s) => s.text)
    .join(" ")
    .match(/(\d{2,3})\s*°?C/);
  if (!oven || !match) return null;
  const target = Number(match[1]);
  const result = ovenCalibration(oven.readings ?? [], target);
  return (
    <div className="notice oven-suggestion">
      <strong>
        🔥 내 오븐: 원문 {target}°C
        {oven.autoApply && result.ready
          ? ` → 설정 제안 ${result.suggested}°C`
          : ""}
      </strong>
      <p>{result.note}</p>
      {!oven.autoApply && result.ready && (
        <p>
          실측 제안: {result.suggested}°C · 자동 적용은 오븐 설정에서 선택할 수
          있어요.
        </p>
      )}
      <Link href="/science?tab=oven">측정과 열 쏠림 기록 ↗</Link>
    </div>
  );
}
// 섭씨 보정은 온도계 실측에서만 구하고 갈변 위치는 별도의 상대 지도에 저장합니다.
function OvenScreen() {
  const { boot, profileId, save } = useLab();
  const previous = boot!.user.settings.find((s) => s.kind === "oven-profile");
  const [name, setName] = useState(previous?.name ?? "우리 집 오븐");
  const [target, setTarget] = useState(previous?.target ?? 180);
  const [measured, setMeasured] = useState("");
  const [position, setPosition] = useState("가운데");
  const [readings, setReadings] = useState<any[]>(previous?.readings ?? []);
  const [heatmap, setHeatmap] = useState<number[]>(
    previous?.heatmap ?? Array(9).fill(0),
  );
  const [auto, setAuto] = useState(previous?.autoApply ?? false);
  const result = ovenCalibration(readings, target);
  const observations = boot!.user.settings.filter(
    (s) => s.kind === "oven-observation",
  );
  return (
    <div className="science-sheet">
      <div className="sticker-label">MEET YOUR OVEN 🔥</div>
      <h2>오븐에도 성격이 있대요.</h2>
      <div className="two-column">
        <section>
          <label className="field">
            오븐 이름
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="field-grid">
            <label className="field">
              설정 온도 °C
              <input
                type="number"
                min="80"
                max="260"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              />
            </label>
            <label className="field">
              독립 온도계 측정 °C
              <input
                type="number"
                min="50"
                max="300"
                value={measured}
                onChange={(e) => setMeasured(e.target.value)}
                placeholder="색으로 추정하지 않아요"
              />
            </label>
            <label className="field">
              측정 위치
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              >
                {["가운데", "앞쪽", "뒤쪽", "왼쪽", "오른쪽"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="button outline"
            disabled={
              !measured ||
              Number(measured) < 50 ||
              Number(measured) > 300 ||
              target < 80 ||
              target > 260
            }
            onClick={() => {
              setReadings([
                ...readings,
                {
                  setpoint: target,
                  measured: Number(measured),
                  position,
                  at: new Date().toISOString(),
                },
              ]);
              setMeasured("");
            }}
          >
            측정값 추가
          </button>
          <p className="small muted">
            예열 후 온도가 안정된 상태에서 서로 다른 시점에 측정하세요. 온도계는
            기기 설명서에 맞게 사용하세요.
          </p>
          <div className="oven-offset">
            <strong>
              {result.offset === null
                ? "?"
                : `${result.offset > 0 ? "+" : ""}${result.offset}°C`}
            </strong>
            <span>{result.count}회 실측 · 중앙값 편차</span>
          </div>
          <p>{result.note}</p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={auto}
              disabled={!result.ready}
              onChange={(e) => setAuto(e.target.checked)}
            />
            실측 범위와 가까운 레시피에 설정 제안 자동 반영
          </label>
        </section>
        <section>
          <h3>어느 쪽 색이 먼저 진해지나요?</h3>
          <p className="small muted">
            굽는 중 관찰한 상대적인 열 쏠림이에요. 사진·갈변만으로 +12°C 같은
            온도 차이를 만들지는 않아요.
          </p>
          <div className="oven-map-caption">오븐 뒤쪽</div>
          <div className="oven-map">
            {heatmap.map((v, i) => (
              <button
                className={`heat-${v}`}
                key={i}
                aria-label={`${Math.floor(i / 3) + 1}행 ${(i % 3) + 1}열 색 상태`}
                onClick={() =>
                  setHeatmap(heatmap.map((x, j) => (j === i ? (x + 1) % 4 : x)))
                }
              >
                {["?", "연함", "황금", "진함"][v]}
              </button>
            ))}
          </div>
          <div className="oven-map-caption">
            오븐 앞쪽 · 클릭하면 색이 바뀌어요
          </div>
          <h3>굽는 김에 쌓인 관찰 {observations.length}번</h3>
          {observations.slice(-4).map((o) => (
            <p className="small" key={o.id}>
              {o.recipeTitle} · 계획 {o.plannedMinutes}분 / 실제{" "}
              {amount(o.actualMinutes)}분 · {o.finalColor ?? "색 미기록"}
            </p>
          ))}
          <p className="muted small">
            관찰형 타이머가 이곳에 쌓여요. 색 기록은 굽기 경향에만 사용하며 온도
            보정값으로 변환하지 않아요.
          </p>
        </section>
      </div>
      <button
        className="button primary"
        onClick={() =>
          save("settings", {
            id: `oven-${profileId}`,
            kind: "oven-profile",
            name,
            target,
            readings,
            heatmap,
            autoApply: auto && result.ready,
          })
        }
      >
        오븐 성격 저장
      </button>
      <details className="space-top">
        <summary>측정 이력 {readings.length}개</summary>
        {readings.map((r, i) => (
          <p key={i}>
            {r.position} 설정 {r.setpoint} / 실측 {r.measured}°C{" "}
            <button
              className="text-button"
              onClick={() => setReadings(readings.filter((_, j) => i !== j))}
            >
              이 측정 제외
            </button>
          </p>
        ))}
      </details>
      <a
        href={scienceSources.oven}
        target="_blank"
        rel="noreferrer"
        className="inline-link"
      >
        예열·온도계·열 쏠림 참고 ↗
      </a>
    </div>
  );
}

function PanInput({
  title,
  value,
  onChange,
}: {
  title: string;
  value: PanSpec;
  onChange: (v: PanSpec) => void;
}) {
  return (
    <section className="pan-input">
      <h3>{title}</h3>
      <label className="field">
        모양
        <select
          value={value.shape}
          onChange={(e) =>
            onChange({ ...value, shape: e.target.value as PanSpec["shape"] })
          }
        >
          <option value="round">원형</option>
          <option value="rect">사각</option>
          <option value="muffin">원형 머핀 칸</option>
        </select>
      </label>
      <div className="field-grid">
        {[
          ["width", value.shape === "rect" ? "가로 cm" : "내부 지름 cm"],
          ...(value.shape === "rect" ? [["length", "세로 cm"]] : []),
          ["depth", "반죽 충전 높이 cm"],
          ["count", "팬 또는 칸 수"],
        ].map(([key, label]) => (
          <label className="field" key={key}>
            {label}
            <input
              type="number"
              min="0.1"
              step={key === "count" ? "1" : ".1"}
              value={(value as any)[key] ?? 0}
              onChange={(e) =>
                onChange({ ...value, [key]: Number(e.target.value) })
              }
            />
          </label>
        ))}
      </div>
      <div
        className={`pan-shape ${value.shape}`}
        style={{
          aspectRatio:
            value.shape === "rect"
              ? `${value.width}/${value.length ?? 1}`
              : "1",
        }}
      >
        {value.count}개 × 충전 {value.depth}cm
      </div>
    </section>
  );
}
// 팬의 반죽 부피로 배합량만 계산하며 완료 시간 대신 첫 관찰 구간을 안내합니다.
function PanScreen() {
  const { boot, act, profileId, save } = useLab();
  const [original, setOriginal] = useState<PanSpec>({
    shape: "round",
    width: 18,
    depth: 3,
    count: 1,
  });
  const [target, setTarget] = useState<PanSpec>({
    shape: "rect",
    width: 20,
    length: 20,
    depth: 3,
    count: 1,
  });
  const [minutes, setMinutes] = useState(35);
  const [id, setId] = useState(
    boot!.catalog.recipes.find((r) => r.category === "cake")!.id,
  );
  const [result, setResult] = useState<any>(null);
  const recipe = boot!.catalog.recipes.find((r) => r.id === id)!;
  return (
    <div className="science-sheet">
      <div className="sticker-label">HELP! WRONG PAN!</div>
      <h2>레시피는 원형, 내 팬은 사각?</h2>
      <p className="small muted">
        아래 치수는 입력 예시입니다. 선택한 원문 레시피의 실제 팬 치수와 반죽
        충전 높이를 직접 확인해 넣어주세요.
      </p>
      <label className="field">
        재료를 환산할 레시피
        <select
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setResult(null);
          }}
        >
          {boot!.catalog.recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>
      <div className="two-column">
        <PanInput
          title="레시피 기준"
          value={original}
          onChange={(v) => {
            setOriginal(v);
            setResult(null);
          }}
        />
        <PanInput
          title="내가 가진 팬"
          value={target}
          onChange={(v) => {
            setTarget(v);
            setResult(null);
          }}
        />
      </div>
      <label className="field narrow">
        원래 굽기 시간 (분)
        <input
          type="number"
          min="1"
          max="600"
          value={minutes}
          onChange={(e) => {
            setMinutes(Number(e.target.value));
            setResult(null);
          }}
        />
      </label>
      <button
        className="button primary"
        onClick={async () => {
          const r = await act(() =>
            api(`features/pan?profileId=${profileId}`, {
              original,
              target,
              minutes,
            }),
          );
          if (r) setResult(r);
        }}
      >
        부피로 환산하기 ↗
      </button>
      {result && (
        <>
          <div className="pan-answer">
            <strong>{result.factor}배</strong>
            <p>
              반죽 부피 {amount(result.originalVolume)}ml →{" "}
              {amount(result.targetVolume)}ml
            </p>
            <Tag>
              첫 관찰 알림: {result.checkFrom}~{result.checkUntil}분
            </Tag>
          </div>
          <p className="notice">
            {result.note} 팽창 여유가 남도록 팬의 실제 높이를 확인하세요. 팬
            재질과 반죽 종류가 달라지면 결과도 달라져요.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>재료</th>
                  <th>원래</th>
                  <th>내 팬의 양</th>
                </tr>
              </thead>
              <tbody>
                {recipe.ingredients.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {
                        boot!.catalog.ingredients.find((g) => g.id === i.id)
                          ?.name
                      }
                    </td>
                    <td>
                      {amount(i.quantity)} {i.unit}
                    </td>
                    <td>
                      {amount(i.quantity * result.factor)} {i.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="button outline"
            onClick={() =>
              save("versions", {
                recipeId: id,
                label: `${recipe.title} 팬 부피 ${result.factor}배`,
                status: "UNVERIFIED_IDEA",
                changes: [result.note],
                recipe: {
                  ...recipe,
                  evidence: "EDITORIAL_CHECKED",
                  ingredients: recipe.ingredients.map((i) => ({
                    ...i,
                    quantity: i.quantity * result.factor,
                  })),
                  yieldCount: recipe.yieldCount * result.factor,
                  pan: {
                    shape: target.shape,
                    width: target.width,
                    height: target.length,
                    depth: target.depth,
                  },
                  steps: [
                    {
                      text: `팬과 충전 높이가 달라요. ${result.checkFrom}~${result.checkUntil}분에 첫 관찰 후 원문의 완료 기준을 확인하세요. 이는 완료 시간을 예측한 값이 아닙니다.`,
                      advanced: result.note,
                    },
                    ...recipe.steps,
                  ],
                },
              })
            }
          >
            검토할 수정본으로 저장
          </button>
        </>
      )}
    </div>
  );
}

// 실외 예보와 사용자가 직접 잰 실내 값을 구분합니다. 위치는 도시 중심부만 조회합니다.
function WeatherScreen() {
  const { act, profileId, save } = useLab();
  const [city, setCity] = useState("seoul");
  const [weather, setWeather] = useState<any>(null);
  const [temperature, setTemperature] = useState(23);
  const [humidity, setHumidity] = useState(50);
  const [indoor, setIndoor] = useState(false);
  const [busy, setBusy] = useState(false);
  const advice = weatherAdvice(temperature, humidity);
  return (
    <div className="science-sheet">
      <div className="sticker-label">TODAY'S DOUGH FORECAST ☁️</div>
      <h2>오늘의 공기, 반죽은 어때?</h2>
      <div className="field-grid">
        <label className="field">
          도시 중심부 날씨
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {[
              ["seoul", "서울"],
              ["busan", "부산"],
              ["daegu", "대구"],
              ["daejeon", "대전"],
              ["gwangju", "광주"],
              ["jeju", "제주"],
            ].map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await act(() =>
              api(`features/weather?profileId=${profileId}`, { city }),
            );
            if (r) {
              setWeather(r);
              if (!indoor) {
                setTemperature(r.temperature);
                setHumidity(r.humidity);
              }
            }
            setBusy(false);
          }}
        >
          {busy ? "가져오는 중…" : "실제 날씨 불러오기"}
        </button>
      </div>
      {weather && (
        <p className="small muted">
          {weather.cityName} 실외 모델 값 · 기준 {weather.weatherTime} · 수집{" "}
          {new Date(weather.fetchedAt).toLocaleString("ko-KR")}
        </p>
      )}
      <label className="check-label">
        <input
          type="checkbox"
          checked={indoor}
          onChange={(e) => setIndoor(e.target.checked)}
        />
        실내 온습도계로 직접 측정한 값을 사용해요
      </label>
      <div className="weather-dials">
        <label className="field">
          {indoor ? "실내" : "참고"} 온도 °C
          <input
            type="number"
            min="-30"
            max="55"
            value={temperature}
            onChange={(e) =>
              setTemperature(
                Math.max(-30, Math.min(55, Number(e.target.value))),
              )
            }
          />
        </label>
        <label className="field">
          {indoor ? "실내" : "참고"} 상대습도 %
          <input
            type="number"
            min="0"
            max="100"
            value={humidity}
            onChange={(e) =>
              setHumidity(Math.max(0, Math.min(100, Number(e.target.value))))
            }
          />
        </label>
      </div>
      <div className="weather-tips">
        {advice.tips.map((tip, i) => (
          <article key={tip}>
            <span>{["☁️", "🧈", "🌱"][i % 3]}</span>
            <p>{tip}</p>
          </article>
        ))}
      </div>
      <p className="notice">
        실외 날씨는 주방 실내·반죽 온도를 대신하지 않아요. 실내 값을 직접
        입력하면 더 유용해요. {advice.thresholdNote}
      </p>
      <button
        className="button outline"
        onClick={() =>
          save("settings", {
            kind: "baking-weather-note",
            temperature,
            humidity,
            indoor,
            city,
            tips: advice.tips,
            observedAt: new Date().toISOString(),
          })
        }
      >
        오늘의 조건 기록
      </button>
      <p className="small">
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          날씨: Open-Meteo · CC BY 4.0 ↗
        </a>{" "}
        ·{" "}
        <a href={advice.source} target="_blank" rel="noreferrer">
          습도·머랭 참고 ↗
        </a>
      </p>
    </div>
  );
}

// 실제로 입력한 A/B 측정값만 저장하고 조건·배합이 같은 로컬 실험끼리 비교합니다.
function TwinsScreen() {
  const { boot, profileId, act, notify } = useLab();
  const [id, setId] = useState(
    boot!.catalog.recipes.find((r) => r.category === "cookie")!.id,
  );
  const [variable, setVariable] = useState("chill");
  const [aValue, setAValue] = useState("0분");
  const [bValue, setBValue] = useState("30분");
  const [aDiameter, setADiameter] = useState("");
  const [bDiameter, setBDiameter] = useState("");
  const [aThickness, setAThickness] = useState("");
  const [bThickness, setBThickness] = useState("");
  const [controlled, setControlled] = useState(false);
  const [shared, setShared] = useState(false);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const previous = boot!.user.settings.filter(
    (s) => s.kind === "twin-experiment",
  );
  async function photo(file: File) {
    const form = new FormData();
    form.set("file", file);
    const row = await act(() => api(`uploads?profileId=${profileId}`, form));
    if (row) setPhotos([...photos, row.id].slice(-2));
  }
  return (
    <div className="science-sheet">
      <div className="sticker-label">TWIN BAKE / A VS B</div>
      <h2>반죽 반, 궁금증 두 배.</h2>
      <p>
        한 배합을 같은 무게로 나누고 딱 한 조건만 바꿔보세요. 치수는 완전히 식힌
        뒤 mm로 측정합니다.
      </p>
      <div className="field-grid">
        <label className="field">
          동일한 원본 레시피
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {boot!.catalog.recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          바꿀 변수
          <select
            value={variable}
            onChange={(e) => {
              setVariable(e.target.value);
              setAValue("");
              setBValue("");
            }}
          >
            <option value="chill">냉장 휴지 시간</option>
            <option value="butter">버터 비율</option>
            <option value="sugar">설탕 비율</option>
            <option value="pan">팬 표면</option>
          </select>
        </label>
      </div>
      <div className="twin-columns">
        {[
          [
            "A",
            aValue,
            setAValue,
            aDiameter,
            setADiameter,
            aThickness,
            setAThickness,
          ],
          [
            "B",
            bValue,
            setBValue,
            bDiameter,
            setBDiameter,
            bThickness,
            setBThickness,
          ],
        ].map(([label, value, set, diameter, setD, thickness, setT]: any) => (
          <section key={label} className={`twin-half half-${label}`}>
            <h3>{label}</h3>
            <label className="field">
              바꾼 조건
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={
                  variable === "chill" ? "예: 30분" : "예: 원본 대비 +10%"
                }
              />
            </label>
            <label className="field">
              식힌 뒤 지름 mm
              <input
                type="number"
                min=".1"
                max="1000"
                step=".1"
                value={diameter}
                onChange={(e) => setD(e.target.value)}
              />
            </label>
            <label className="field">
              식힌 뒤 두께 mm
              <input
                type="number"
                min=".1"
                max="500"
                step=".1"
                value={thickness}
                onChange={(e) => setT(e.target.value)}
              />
            </label>
          </section>
        ))}
      </div>
      <label className="field">
        A·B 사진 (각각 선택, 최대 두 장)
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => e.target.files?.[0] && photo(e.target.files[0])}
        />
      </label>
      <div className="twin-photos">
        {photos.map((p, i) => (
          <figure key={p}>
            <img
              src={`/api/uploads/${p}?profileId=${profileId}`}
              alt={`쌍둥이 실험 ${i === 0 ? "A" : "B"} 사진`}
            />
            <figcaption>{i === 0 ? "A" : "B"}</figcaption>
          </figure>
        ))}
      </div>
      <label className="field">
        관찰 메모
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="동일한 무게·오븐·위치·시간인지, 달라진 다른 조건은 없었는지 적어주세요."
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={controlled}
          onChange={(e) => setControlled(e.target.checked)}
        />
        선택한 변수 이외에 배합·반죽 무게·굽는 조건을 같게 유지했어요
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={shared}
          onChange={(e) => setShared(e.target.checked)}
        />
        이 로컬 멘토링 프로그램의 집계에 포함해요 (외부 게시 없음)
      </label>
      <button
        className="button primary space-top"
        onClick={async () => {
          const r = await act(() =>
            api(`features/twins?profileId=${profileId}`, {
              recipeId: id,
              variable,
              aValue,
              bValue,
              aDiameter: Number(aDiameter),
              bDiameter: Number(bDiameter),
              aThickness: Number(aThickness),
              bThickness: Number(bThickness),
              ovenId: `oven-${profileId}`,
              controlled,
              shared,
              photos,
              note,
            }),
          );
          if (r) {
            setResult(r);
            notify("측정한 실험을 저장했어요.");
          }
        }}
      >
        A와 B, 결과 남기기 ↗
      </button>
      {result && (
        <div className="twin-result">
          {(result.saved ?? result.personal) && (
            <strong>
              나의 지름 변화{" "}
              {amount(
                (((result.saved ?? result.personal).bDiameter -
                  (result.saved ?? result.personal).aDiameter) /
                  (result.saved ?? result.personal).aDiameter) *
                  100,
              )}
              %
            </strong>
          )}
          <p>
            동일 프로토콜: {result.summary.trials}회 · {result.summary.ovens}개
            등록 오븐 · {result.summary.participants}명
          </p>
          <p>
            오븐별 평균 변화:{" "}
            {result.summary.meanChange === null
              ? "집계 가능한 자료 없음"
              : `${result.summary.meanChange}%`}
          </p>
          <small>{result.summary.notice}</small>
        </div>
      )}
      <h3 className="space-top">내 실험 {previous.length}개</h3>
      {previous.map((p) => (
        <div className="inventory-row" key={p.id}>
          <strong>
            {boot!.catalog.recipes.find((r) => r.id === p.recipeId)?.title}
          </strong>
          <span>
            {p.aValue} → {p.bValue}
          </span>
          <Tag>{p.controlled && p.shared ? "로컬 집계 포함" : "개인 관찰"}</Tag>
          <button
            className="text-button"
            onClick={async () => {
              const summary = await act(() =>
                api(
                  `features/twins?profileId=${profileId}&protocol=${encodeURIComponent(p.protocolKey)}`,
                ),
              );
              if (summary) setResult({ summary, personal: p });
            }}
          >
            같은 실험 집계
          </button>
        </div>
      ))}
    </div>
  );
}

// GLB는 서버의 사용자 데이터 폴더에 보관합니다. 원본 코드의 기본 자산을 덮어쓰지 않습니다.
export function ModelManager() {
  const { boot, profileId, act, save, refresh, notify } = useLab();
  const models = boot!.user.settings.filter((s) => s.kind === "custom-model");
  const home = boot!.user.settings.find((s) => s.kind === "model-preference");
  const [busy, setBusy] = useState(false);
  return (
    <div className="science-sheet">
      <div className="sticker-label">YOUR OBJECT, YOUR LAB 🪩</div>
      <h2>내가 고른 빵을 올려봐요.</h2>
      <p>
        GLB 2.0 한 파일에 모델과 텍스처를 포함하고, Draco·Meshopt·KTX 압축을
        끄고 내보내세요. 파일은 이 컴퓨터에만 저장됩니다.
      </p>
      <label className="field">
        내 GLB 파일 선택 (20MB 이하)
        <input
          type="file"
          accept=".glb,model/gltf-binary"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            const form = new FormData();
            form.set("file", file);
            const row = await act(() =>
              api(`features/models/import?profileId=${profileId}`, form),
            );
            if (row) {
              await save("settings", {
                id: `model-pref-${profileId}`,
                kind: "model-preference",
                homeModelId: row.uploadId,
              });
              await refresh();
              notify("홈페이지 오브제를 내 모델로 바꿨어요.");
            }
            setBusy(false);
            e.target.value = "";
          }}
        />
      </label>
      {busy && <p>GLB 구조를 확인하고 있어요…</p>}
      <div className="inventory-list">
        {models.map((model) => (
          <div className="inventory-row" key={model.id}>
            <div>
              <strong>{model.name}</strong>
              <small>
                {amount(model.byteSize / 1024)}KB · 이 프로필의 로컬 파일
              </small>
            </div>
            <button
              className="button outline small-button"
              onClick={() =>
                save("settings", {
                  id: `model-pref-${profileId}`,
                  kind: "model-preference",
                  homeModelId: model.uploadId,
                })
              }
            >
              {home?.homeModelId === model.uploadId
                ? "홈에 표시 중"
                : "홈 오브제로 쓰기"}
            </button>
          </div>
        ))}
      </div>
      <button
        className="button outline"
        onClick={() =>
          save("settings", {
            id: `model-pref-${profileId}`,
            kind: "model-preference",
            homeModelId: null,
          })
        }
      >
        기본 오브제로 되돌리기
      </button>
      <p className="notice">
        직접 파일을 넣으며 개발하려면 <code>public/assets/user-models</code>에
        GLB를 두고 <code>content/models.json</code>의 home 경로를 수정할 수도
        있어요. 다른 프로필에는 자동 적용되지 않는 업로드 방식과 달리 이 설정
        파일은 프로젝트 공통입니다.
      </p>
    </div>
  );
}
