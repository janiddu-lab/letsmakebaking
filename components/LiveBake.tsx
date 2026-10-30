"use client";
import { useEffect, useState } from "react";
import { api, useLab, amount } from "./context";
import { Tag } from "./ui";
import { bakeStage, ovenCalibration } from "@/lib/science";
import type { Recipe } from "@/lib/types";

type Observation = { atMin: number; color: string; checkpoint: string };
type LiveState = {
  startedAt: number | null;
  pausedAt: number | null;
  pausedTotal: number;
  plannedMinutes: number;
  answers: Observation[];
  nextCheck: number | null;
  finished: boolean;
};
const elapsed = (s: LiveState, now: number) =>
  s.startedAt
    ? Math.max(0, ((s.pausedAt ?? now) - s.startedAt - s.pausedTotal) / 60000)
    : 0;
const colorLabels: Record<string, string> = {
  pale: "연함",
  golden: "황금",
  dark: "진함",
};
// 타이머는 카메라·온도 센서가 아닙니다. 공정 설명과 사용자가 관찰한 값을 분리해 저장합니다.
export default function LiveBake({
  recipe,
  sessionId,
}: {
  recipe: Recipe;
  sessionId: string;
}) {
  const { boot, profileId, act, refresh } = useLab();
  const recordId = `live-${sessionId}`;
  const saved = boot!.user.settings.find((s) => s.id === recordId);
  const candidate =
    recipe.steps
      .filter((s) => /구워|굽습|구웁|굽기/.test(s.text) && s.timerMin)
      .map((s) => s.timerMin!)
      .at(-1) ?? 20;
  const [state, setState] = useState<LiveState>(
    saved?.state ?? {
      startedAt: null,
      pausedAt: null,
      pausedTotal: 0,
      plannedMinutes: candidate,
      answers: [],
      nextCheck: null,
      finished: false,
    },
  );
  const [now, setNow] = useState(Date.now());
  const [pending, setPending] = useState(false);
  const oven = boot!.user.settings.find((s) => s.kind === "oven-profile");
  const target = Number(
    recipe.steps
      .map((s) => s.text)
      .join(" ")
      .match(/(\d{2,3})\s*°?C/)?.[1] ?? 180,
  );
  const calibration = ovenCalibration(oven?.readings ?? [], target);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  const minutes = elapsed(state, now);
  const progress = state.startedAt
    ? Math.min(minutes / state.plannedMinutes, 1)
    : 0;
  const stage = bakeStage(recipe.category, progress);
  const checkpoint =
    progress >= 0.85 ? "late" : progress >= 0.65 ? "middle" : null;
  const due =
    !!checkpoint &&
    !state.answers.some((a) => a.checkpoint === checkpoint) &&
    !state.finished &&
    !state.pausedAt;
  const checkRemaining =
    state.nextCheck !== null
      ? Math.max(0, state.nextCheck - minutes)
      : Math.max(0, state.plannedMinutes - minutes);
  async function persist(next: LiveState) {
    setState(next);
    await act(() =>
      api(`state/settings?profileId=${profileId}`, {
        id: recordId,
        kind: "live-bake",
        recipeId: recipe.id,
        state: next,
      }),
    );
  }
  async function answer(color: string) {
    const atMin = elapsed(state, Date.now());
    const next = {
      ...state,
      answers: [
        ...state.answers,
        { atMin, color, checkpoint: checkpoint ?? "manual" },
      ],
      nextCheck:
        color === "pale" ? atMin + 2 : color === "golden" ? atMin + 1 : atMin,
    };
    await persist(next);
  }
  async function finish() {
    if (pending) return;
    setPending(true);
    const actual = elapsed(state, Date.now());
    const result = await act(() =>
      api(`state/settings?profileId=${profileId}`, {
        id: `observation-${sessionId}`,
        kind: "oven-observation",
        ovenId: `oven-${profileId}`,
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        plannedMinutes: state.plannedMinutes,
        actualMinutes: actual,
        answers: state.answers,
        finalColor: state.answers.at(-1)?.color ?? null,
        measuredOffset: null,
        observedAt: new Date().toISOString(),
      }),
    );
    if (result) {
      await persist({ ...state, finished: true, pausedAt: Date.now() });
      await refresh();
    }
    setPending(false);
  }
  return (
    <section className="live-bake">
      <div className="live-bake-head">
        <div>
          <p className="eyebrow">LIVE FROM YOUR OVEN</p>
          <h2>오븐 속 생중계 🍪</h2>
        </div>
        <Tag>
          {state.finished
            ? "관찰 완료"
            : state.startedAt
              ? "관찰하며 굽는 중"
              : "준비 중"}
        </Tag>
      </div>
      <div className="live-bake-grid">
        <div className={`oven-animation category-${recipe.category}`}>
          <div className="oven-window">
            <div className="heat-waves">≈ ≈ ≈</div>
            <div
              className="baking-slice"
              style={{
                transform: `scaleX(${1 + progress * 0.14}) scaleY(${0.75 + progress * 0.25})`,
                background: `hsl(${44 - progress * 15} 78% ${81 - progress * 24}%)`,
              }}
            >
              <div className="slice-bubbles">
                {Array.from({ length: 9 }, (_, i) => (
                  <i
                    key={i}
                    style={{
                      opacity: progress * 0.7,
                      transform: `scale(${0.5 + progress * 0.5})`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="oven-tray" />
          </div>
          <span>설명용 애니메이션 · 실시간 카메라 아님</span>
        </div>
        <div>
          <p className="live-stage-title">{stage.title}</p>
          <p>{stage.text}</p>
          <div className="live-clock">
            <strong>
              {Math.floor(minutes)}:
              {String(Math.floor((minutes % 1) * 60)).padStart(2, "0")}
            </strong>
            <small>경과 / 계획 {state.plannedMinutes}분</small>
          </div>
          {!state.startedAt ? (
            <>
              <label className="field">
                원문 기준 계획 굽기 시간 (분)
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={state.plannedMinutes}
                  onChange={(e) =>
                    setState({
                      ...state,
                      plannedMinutes: Number(e.target.value),
                    })
                  }
                />
              </label>
              <button
                className="button primary"
                disabled={
                  !Number.isFinite(state.plannedMinutes) ||
                  state.plannedMinutes < 1 ||
                  state.plannedMinutes > 600
                }
                onClick={() => persist({ ...state, startedAt: Date.now() })}
              >
                반죽을 넣었어요 · 시작
              </button>
            </>
          ) : !state.finished ? (
            <div className="row-actions">
              <button
                className="button outline"
                onClick={() =>
                  persist(
                    state.pausedAt
                      ? {
                          ...state,
                          pausedTotal:
                            state.pausedTotal + Date.now() - state.pausedAt,
                          pausedAt: null,
                        }
                      : { ...state, pausedAt: Date.now() },
                  )
                }
              >
                {state.pausedAt ? "관찰 타이머 계속" : "타이머 잠시 멈춤"}
              </button>
              <button
                className="button primary"
                disabled={pending}
                onClick={finish}
              >
                완료 기준 확인 · 관찰 저장
              </button>
            </div>
          ) : (
            <p>
              관찰을 내 오븐 기록에 저장했어요. 이 결과로 온도 차이를 추정하지는
              않아요.
            </p>
          )}
          {oven?.autoApply && calibration.ready && (
            <p className="small">
              실측 기반 설정 제안: 원문 {target}°C → 내 오븐{" "}
              {calibration.suggested}°C
            </p>
          )}
        </div>
      </div>
      {state.startedAt && !state.finished && (
        <>
          <div className={`observation-question ${due ? "due" : ""}`}>
            <h3>
              {due
                ? "지금 한 번 관찰해 볼까요?"
                : "문을 열지 않고 색을 관찰할 수 있나요?"}
            </h3>
            <p>가장자리 색은 어때요? 원문의 완료 확인법도 함께 보세요.</p>
            <div className="color-answers">
              {[
                ["pale", "연함"],
                ["golden", "황금"],
                ["dark", "진함"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={`color-${id}`}
                  disabled={!!state.pausedAt}
                  onClick={() => answer(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {state.nextCheck !== null && (
              <p className="next-observation">
                다음 관찰 알림까지 {Math.ceil(checkRemaining)}분 · 완료 시간
                예측이 아니에요.
              </p>
            )}
            {state.answers.at(-1)?.color === "dark" && (
              <p className="notice">
                색이 진해졌어요. 원문의 완료 기준을 지금 확인하세요. 케이크·빵은
                색만으로 내부 익음을 판단하지 마세요.
              </p>
            )}
            {progress >= 1 && (
              <p className="notice">
                계획 시간이 지났어요. 타이머 숫자보다 레시피의 완료 기준을
                확인하고 마칠 시점을 직접 선택해 주세요.
              </p>
            )}
          </div>
          <div className="observation-log">
            {state.answers.map((a, i) => (
              <Tag key={i}>
                {amount(a.atMin)}분: {colorLabels[a.color] ?? a.color}
              </Tag>
            ))}
          </div>
        </>
      )}
      <p className="small muted">
        케이크를 굽는 초반에는 문을 열도록 유도하지 않아요. 팬 돌리기도 레시피가
        허용할 때만 하세요. 창을 닫으면 알림은 보장되지 않지만 재진입 시 시간을
        복원합니다.
      </p>
    </section>
  );
}
