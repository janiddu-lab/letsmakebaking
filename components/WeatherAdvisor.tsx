"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { api, useLab } from "./context";
import { loadCityWeather, weatherCities } from "@/lib/weather";
import { weatherPlan, weatherCandidates } from "@/lib/weather-plan";
import type { Recipe } from "@/lib/types";

// 센서가 없는 웹이므로 실내 입력과 실외 모델 자료의 출처를 항상 구분합니다.
export default function WeatherAdvisor() {
  const { boot, save } = useLab();
  const params = useSearchParams();
  const router = useRouter();
  const [recipeId, setRecipeId] = useState(boot!.catalog.recipes.some(r => r.id === params.get("recipe")) ? params.get("recipe")! : "");
  const [city, setCity] = useState("seoul"), [weather, setWeather] = useState<any>(null);
  const [temperature, setTemperature] = useState(""), [humidity, setHumidity] = useState("");
  const [indoor, setIndoor] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [checks, setChecks] = useState<string[]>([]), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false);
  const recipe = boot!.catalog.recipes.find(r => r.id === recipeId) ?? null;
  const task = recipeId === "__icing" ? "icing" : "recipe";
  const valid = temperature.trim() !== "" && humidity.trim() !== "" && Number.isFinite(Number(temperature)) && Number(temperature) >= -30 && Number(temperature) <= 55 && Number.isFinite(Number(humidity)) && Number(humidity) >= 0 && Number(humidity) <= 100;
  const plan = valid ? weatherPlan(recipe, Number(temperature), Number(humidity), task) : null;
  const candidates = valid ? weatherCandidates(boot!.catalog.recipes, Number(temperature), Number(humidity)) : [];
  useEffect(() => { setChecks([]); setSaved(false); }, [recipeId, temperature, humidity, indoor, city]);
  async function load() {
    setBusy(true); setError("");
    try {
      const result = await loadCityWeather(city, () => api("features/weather", { city })); setWeather(result);
      if (!indoor) { setTemperature(String(result.temperature)); setHumidity(String(result.humidity)); }
    } catch (e) { setError(`${e instanceof Error ? e.message : "날씨를 가져오지 못했어요."} 실내 값을 입력해 계속할 수 있어요.`); }
    finally { setBusy(false); }
  }
  async function savePlan(start = false) {
    if (!plan || !valid || saving) return;
    setSaving(true);
    try {
      const row = await save("settings", { id: `weather-note-${recipe?.id ?? task}`, kind: "baking-weather-note", recipeId: recipe?.id ?? null, task, temperature: Number(temperature), humidity: Number(humidity), indoor, city, forecast: !indoor ? weather : null, checks, steps: plan.steps, observedAt: new Date().toISOString() });
      if (row) { setSaved(true); if (start && recipe) router.push(`/recipes/${recipe.id}/bake`); }
    } finally { setSaving(false); }
  }
  return <div className="science-sheet weather-advisor">
    <div className="sticker-label">TODAY'S BAKING PLAN ☁️</div>
    <h2>날씨를 보고, 오늘의 베이킹을 준비해요</h2>
    <p>만들 메뉴를 고르면 재료를 꺼내기 전부터 식힘·포장까지 무엇을 확인할지 알려드려요.</p>
    <section className="weather-environment">
      <h3>1. 작업 환경 확인</h3>
      <div className="field-grid"><label className="field">도시 중심부 날씨<select aria-label="도시 중심부 날씨" value={city} disabled={busy} onChange={e => { setCity(e.target.value); setWeather(null); setError(""); if (!indoor) { setTemperature(""); setHumidity(""); } }}>{Object.entries(weatherCities).map(([id, c]) => <option value={id} key={id}>{c.name}</option>)}</select></label>
        <button className="button primary" onClick={load} disabled={busy}>{busy ? "가져오는 중…" : "실제 날씨 불러오기"}</button></div>
      {error && <p role="alert" className="notice error">{error}</p>}
      {weather && <p className="small muted">{weather.cityName} 실외 모델 값 · 기준 {weather.weatherTime} · Open-Meteo</p>}
      <label className="check-label"><input type="checkbox" checked={indoor} onChange={e => { setIndoor(e.target.checked); if (e.target.checked) { setTemperature(""); setHumidity(""); } else { setTemperature(weather ? String(weather.temperature) : ""); setHumidity(weather ? String(weather.humidity) : ""); } }} />실내 온습도계로 직접 측정한 값을 사용해요</label>
      <div className="weather-dials"><label className="field">온도 °C<input aria-label="작업 환경 온도" type="number" min="-30" max="55" step="any" placeholder="측정값 입력" value={temperature} onChange={e => { setIndoor(true); setTemperature(e.target.value); }} /></label><label className="field">상대습도 %<input aria-label="작업 환경 상대습도" type="number" min="0" max="100" step="any" placeholder="측정값 입력" value={humidity} onChange={e => { setIndoor(true); setHumidity(e.target.value); }} /></label></div>
      <p className="notice">{indoor ? "실내 입력값을 기준으로 안내합니다." : "실외 날씨는 준비 참고용이에요. 실제 주방과 반죽의 온도는 다를 수 있어요."} 숫자를 바꿔도 원문의 물·가루 양, 오븐 온도와 굽는 시간은 자동 변경하지 않아요.</p>
      {!valid && <p role="status">날씨를 불러오거나 온도 -30~55°C, 습도 0~100%를 입력하면 작업 안내가 나타나요.</p>}
    </section>
    <section><h3>2. 무엇을 만들까요?</h3><label className="field">오늘 만들 레시피 또는 작업<select aria-label="오늘 만들 레시피 또는 작업" value={recipeId} onChange={e => setRecipeId(e.target.value)}><option value="">아직 메뉴를 안 골랐어요</option><option value="__icing">머랭·아이싱 작업</option>{boot!.catalog.recipes.map(r => <option value={r.id} key={r.id}>{r.title}</option>)}</select></label>
      {valid && !recipeId && <><p>온습도에 따른 관리 부담을 비교한 후보예요. 성공률이나 보유 재료·알레르기 적합도를 판단한 추천은 아니에요.</p><div className="weather-candidates">{candidates.map(({ recipe: r, reasons }) => <article key={r.id}><h4>{r.title}</h4><p>{reasons.join(" · ")}</p><small>{r.totalMin}분 · 실제 제조 미검증</small><button className="button outline" onClick={() => setRecipeId(r.id)}>이 메뉴의 준비 계획 보기</button><Link href={`/recipes/${r.id}`}>재료·도구 먼저 확인 ↗</Link></article>)}</div></>}
    </section>
    {plan && (recipe || task === "icing") && <section className="weather-action-plan" aria-label="레시피별 작업 계획">
      <h3>3. {recipe?.title ?? "머랭·아이싱"} 작업 계획</h3><p className="notice">{indoor ? "실내 입력 기준" : "실외 참고 기준"} · {plan.summary}. 18·27°C와 습도 70%는 안내 분기를 위한 편집 기준이며 실패 경계값이 아닙니다.</p>
      <div className="weather-plan-grid">{plan.steps.map((step, index) => <article className="weather-plan-card" key={step.id}><h4>{index + 1}. {step.title}</h4><dl><dt>준비할 것</dt><dd>{step.prepare}</dd><dt>확인할 상태</dt><dd>{step.check}</dd><dt>다음 행동</dt><dd>{step.next}</dd></dl><label className="check-label"><input type="checkbox" checked={checks.includes(step.id)} onChange={() => { setChecks(checks.includes(step.id) ? checks.filter(id => id !== step.id) : [...checks, step.id]); setSaved(false); }} />이 확인 사항을 읽고 준비했어요</label><div className="row-actions"><Link href={step.href}>{step.action} ↗</Link><a href={step.source} target="_blank" rel="noreferrer">참고 원리 ↗</a></div></article>)}</div>
      {recipe?.ingredients.some(i => i.id === "yeast" || i.id === "yeast-active") && <ProofObservation key={recipe.id} recipe={recipe} />}
      <div className="row-actions"><button className="button primary" disabled={saving} onClick={() => savePlan()}>{saving ? "저장 중…" : "이 레시피에 작업 조건 저장"}</button>{recipe && <button className="button outline" disabled={saving} onClick={() => savePlan(true)}>조건 저장하고 만들기 시작 →</button>}<Link href="/journal">결과 기록하기 →</Link></div>
      {saved && <p role="status">✓ 작업 조건과 확인 사항을 저장했어요. 이 레시피의 상세·만들기 화면에서도 볼 수 있어요.</p>}
    </section>}
    <details className="space-top"><summary>내가 저장한 작업 조건</summary>{boot!.user.settings.filter(s => s.kind === "baking-weather-note").slice(-5).reverse().map(s => <p key={s.id}>{boot!.catalog.recipes.find(r => r.id === s.recipeId)?.title ?? "환경 메모"} · {s.temperature}°C / {s.humidity}% · {s.indoor ? "실내 입력" : "실외 참고"} · {new Date(s.observedAt).toLocaleString("ko-KR")}</p>)}</details>
    <p className="small"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">날씨 제공: Open-Meteo · CC BY 4.0 ↗</a></p>
  </div>;
}

function ProofObservation({ recipe }: { recipe: Recipe }) {
  const { boot, save } = useLab();
  const prior = boot!.user.settings.filter(s => s.kind === "proof-observation" && s.recipeId === recipe.id).slice(-1)[0];
  const [start, setStart] = useState(String(prior?.startHeight ?? "")), [current, setCurrent] = useState(String(prior?.currentHeight ?? ""));
  const [startedAt, setStartedAt] = useState<number | null>(prior?.startedAt ?? null), [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const valid = Number(start) > 0 && Number.isFinite(Number(start)), ratio = valid && Number(current) > 0 && Number.isFinite(Number(current)) ? Number(current) / Number(start) : null;
  return <section className="weather-proof"><h4>발효는 기다린 시간과 높이를 함께 기록</h4><p>같은 직벽 용기에서 같은 기준으로 높이를 재세요. 높이 비율만으로 발효 완료를 판정하지 않아요.</p><div className="field-grid"><label className="field">시작 반죽 높이 (cm)<input type="number" min="0.1" step="any" value={start} onChange={e => setStart(e.target.value)} /></label><label className="field">현재 반죽 높이 (cm)<input type="number" min="0.1" step="any" value={current} onChange={e => setCurrent(e.target.value)} /></label></div><p role="status">{startedAt ? `경과 ${Math.max(0, Math.floor((now - startedAt) / 60000))}분` : "관찰 시작 전"}{ratio !== null && ` · 높이 ${ratio.toFixed(2)}배`} · 완료 여부는 원문의 부피·촉감 기준으로 확인</p><div className="row-actions"><button className="button outline" disabled={!valid} onClick={async () => { const at = Date.now(); if (await save("settings", { id: `proof-${recipe.id}`, kind: "proof-observation", recipeId: recipe.id, startHeight: Number(start), currentHeight: null, startedAt: at })) { setStartedAt(at); setNow(at); setCurrent(""); } }}>{startedAt ? "새 발효 관찰 시작" : "발효 관찰 시작"}</button><button className="button outline" disabled={!valid || !startedAt || ratio === null} onClick={() => save("settings", { id: `proof-${recipe.id}`, kind: "proof-observation", recipeId: recipe.id, startHeight: Number(start), currentHeight: Number(current), startedAt, observedAt: new Date().toISOString() })}>현재 높이와 경과 저장</button></div></section>;
}

export function RecipeWeatherContext({ recipe }: { recipe: Recipe }) {
  const { boot } = useLab();
  const note = boot!.user.settings.filter(s => s.kind === "baking-weather-note" && s.recipeId === recipe.id).slice(-1)[0];
  return <section className="notice recipe-weather-context">{note ? <><strong>저장한 작업 환경: {note.temperature}°C · {note.humidity}% ({note.indoor ? "실내 입력" : "실외 참고"})</strong><p>{new Date(note.observedAt).toLocaleString("ko-KR")} 기록 · 현재 측정값은 아니에요. 원문 배합과 굽기 설정은 그대로 유지해요.</p></> : <p>이 메뉴를 오늘의 온습도에 맞춰 준비하고 싶나요?</p>}<Link href={`/science?tab=weather&recipe=${recipe.id}`}>이 레시피의 환경별 준비 계획 →</Link></section>;
}
