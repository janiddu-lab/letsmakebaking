"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import dynamic from "next/dynamic";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Download,
  FlaskConical,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
  Camera,
  RefreshCw,
  ShieldCheck,
  MessageCircle,
  Mic,
} from "lucide-react";
import { useLab, api, categories, amount, photoUrl, allergenName } from "./context";
import { Dialog, Empty, PageHeading, SourceList, Tag, useInputDialog } from "./ui";
import { PracticalGuide } from "./PracticalGuide";
import CupWorkshop from "./CupWorkshop";
import ToolAlternatives from "./ToolAlternatives";
import AiPageLinks from "./AiPageLinks";
import { siteActions, replyNavigation } from "@/lib/site-navigation";
import { useLocale } from "./Locale";
const ModelViewer = dynamic(() => import("./ModelViewer"), { ssr: false });

// 수분 슬라이더는 원리를 설명하는 예시이며 실제 빵의 완성 모양을 예측하지 않습니다.
export function LabScreen() {
  const { boot, profileId, act, refresh } = useLab();
  const [model, setModel] = useState("boule");
  const [hydration, setHydration] = useState(65);
  const [query, setQuery] = useState("");
  const [recipeId, setRecipeId] = useState(boot!.catalog.recipes[0].id);
  const [chosen, setChosen] = useState<string[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const c = boot!.catalog;
  const recipe = c.recipes.find((r) => r.id === recipeId)!;
  const [versionId, setVersionId] = useState("");
  const version = boot!.user.versions.find((v) => v.id === versionId);
  const eligible = c.substitutions.filter(
    (r) =>
      (r.kind === "ingredient"
        ? recipe.ingredients.some((i) => i.id === r.fromId)
        : recipe.equipmentIds.includes(r.fromId)) &&
      (r.contexts.includes(recipe.category) || r.contexts.includes("all")) &&
      (r.description + r.conditions).includes(query),
  );
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE BAKING SCIENCE"
        title="궁금해서, 한 번 더 실험"
        description="모양을 돌려보고, 재료의 역할을 알아보고, 한 가지씩 바꿔보세요."
      />
      <div className="notice">
        <Link href="/science?tab=models">
          🪩 내가 준비한 GLB 파일을 업로드하고 홈 오브제로 쓰기 ↗
        </Link>
      </div>
      <div className="two-column lab-columns">
        <section className="model-panel">
          <div className="panel-title">
            <h2>손끝으로 보는 베이킹</h2>
            <Tag>ORIGINAL 3D</Tag>
          </div>
          <ModelViewer name={model} />
          <div className="model-tabs">
            {boot!.assets.models.map((m: any) => (
              <button
                className={`chip ${model === m.id ? "chosen" : ""}`}
                key={m.id}
                onClick={() => setModel(m.id)}
              >
                {m.title}
              </button>
            ))}
          </div>
          <p className="small muted">
            직접 만든 학습용 모델입니다. 실제 제조 결과나 물리 예측을 나타내지
            않아요.
          </p>
        </section>
        <section className="panel">
          <Tag tone="green">한 변수만 바꾸기</Tag>
          <h2>빵 반죽에 물을 더 넣는다면?</h2>
          <p>
            기준 밀가루 500g에서 수분 비율을 바꾸며 배합의 의미를 배워보세요.
          </p>
          <label className="field range-field">
            수분 비율 <strong>{hydration}%</strong>
            <input
              type="range"
              min="55"
              max="85"
              step="1"
              value={hydration}
              onChange={(e) => setHydration(Number(e.target.value))}
            />
          </label>
          <div className="water-cups">
            <span style={{ height: `${hydration * 1.7}px` }} />
            <div>
              <strong>{amount((500 * hydration) / 100)}g</strong>
              <p>밀가루 500g에 들어가는 물</p>
            </div>
          </div>
          <div className="notice">
            {hydration < 63
              ? "상대적으로 단단한 반죽을 다루는 예시예요."
              : hydration < 73
                ? "물과 밀가루 비율을 비교하는 중간 예시예요."
                : "상대적으로 부드럽고 달라붙기 쉬운 반죽의 예시예요."}
            <p>
              밀가루 종류와 부재료에 따라 달라져요. 이 슬라이더가 완성 빵의
              기공이나 성공률을 예측하지는 않아요.
            </p>
          </div>
          <a
            className="inline-link"
            href="https://www.kingarthurbaking.com/pro/reference/bakers-percentage"
            target="_blank"
            rel="noreferrer"
          >
            베이커 퍼센트 근거 읽기 ↗
          </a>
          <Link className="button outline full-width" href="/challenges">
            나의 예측을 도전 과제에 기록하기
          </Link>
        </section>
      </div>
      <section className="panel space-top">
        <div className="panel-title">
          <h2>재료와 도구 대체 실험실</h2>
          <span className="small muted">
            두 가지까지, 조건을 읽고 선택해 주세요.
          </span>
        </div>
        <div className="field-grid">
          <label className="field">
            어떤 레시피를 바꿀까요?
            <select
              value={recipeId}
              onChange={(e) => {
                setRecipeId(e.target.value);
                setChosen([]);
                setPreview(null);
              }}
            >
              {c.recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            대체 안내 검색
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="버터, 거품기…"
            />
          </label>
        </div>
        <div className="rule-grid">
          {eligible.map((r) => (
            <label
              className={`rule-card ${chosen.includes(r.id) ? "selected" : ""}`}
              key={r.id}
            >
              <input
                type="checkbox"
                checked={chosen.includes(r.id)}
                onChange={() => {
                  setChosen(
                    chosen.includes(r.id)
                      ? chosen.filter((id) => id !== r.id)
                      : [...chosen, r.id],
                  );
                  setPreview(null);
                }}
              />
              <div>
                <Tag tone={r.evidence === "reviewed" ? "green" : "amber"}>
                  {r.evidence === "reviewed"
                    ? "근거 대조"
                    : "조건부 · 확인 필요"}
                </Tag>
                <h3>{r.description}</h3>
                <p>{r.conditions}</p>
                <p>
                  <strong>바꿀 과정:</strong> {r.changes}
                </p>
                <small>{r.limits}</small>
              </div>
            </label>
          ))}
        </div>
        {!eligible.length && (
          <p className="muted">이 레시피에 연결된 대체 근거가 아직 없어요.</p>
        )}
        <button
          className="button primary"
          onClick={async () => {
            const p = await act(() =>
              api(`adaptations/preview?profileId=${profileId}`, {
                recipeId,
                ruleIds: chosen,
                scale: 1,
              }),
            );
            if (p) setPreview(p);
          }}
        >
          변경 내용 미리보기 <ArrowRight size={16} />
        </button>
        {preview && (
          <div className="notice">
            <h3>{preview.status}</h3>
            {preview.changes.map((x: string) => (
              <p key={x}>{x}</p>
            ))}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>바뀐 재료</th>
                    <th>필요량</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.recipe.ingredients.map((i: any) => (
                    <tr key={i.id}>
                      <td>{c.ingredients.find((g) => g.id === i.id)?.name}</td>
                      <td>
                        {amount(i.quantity)} {i.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="button outline"
              onClick={async () => {
                const saved = await act(
                  () =>
                    api(`recipe-versions?profileId=${profileId}`, {
                      previewId: preview.previewId,
                      label: `${recipe.title} 대체 실험`,
                    }),
                  "새 실험 버전을 저장했어요.",
                );
                if (saved) await refresh();
              }}
            >
              이 수정본 저장
            </button>
          </div>
        )}
      </section>
      <section className="panel space-top">
        <h2>원본과 나의 수정본 비교</h2>
        <label className="field">
          저장된 버전
          <select
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
          >
            <option value="">비교할 수정본 선택</option>
            {boot!.user.versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        {version ? (
          <div className="two-column">
            <div>
              <h3>원본</h3>
              {c.recipes
                .find((r) => r.id === version.recipeId)
                ?.ingredients.map((i) => (
                  <p key={i.id}>
                    {c.ingredients.find((g) => g.id === i.id)?.name}{" "}
                    {amount(i.quantity)} {i.unit}
                  </p>
                ))}
            </div>
            <div>
              <h3>나의 수정본</h3>
              {version.recipe.ingredients.map((i: any) => (
                <p key={i.id}>
                  {c.ingredients.find((g) => g.id === i.id)?.name}{" "}
                  {amount(i.quantity)} {i.unit}
                </p>
              ))}
              {version.changes.map((s: string) => (
                <p className="advanced-note" key={s}>
                  {s}
                </p>
              ))}
              <Link
                href={`/recipes/${version.recipeId}/bake?version=${version.id}`}
                className="button primary"
              >
                수정본으로 만들기
              </Link>
            </div>
          </div>
        ) : (
          <p className="muted">
            대체 실험에서 수정본을 저장하면 원본과 비교할 수 있어요.
          </p>
        )}
      </section>
    </>
  );
}

// 재료·도구·기술 자료를 같은 탐색 방식으로 연결하고 원문 출처를 보여줍니다.
export function LearnScreen({ id }: { id?: string }) {
  const { boot } = useLab();
  const c = boot!.catalog;
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("type");
    if (t) setTab(t);
  }, []);
  if (id) {
    const article = c.articles.find((a) => a.id === id);
    const ing = c.ingredients.find((i) => i.id === id);
    const tool = c.equipment.find((e) => e.id === id || article?.id === `equipment-${e.id}`);
    if (!article && !ing && !tool)
      return <Empty title="자료를 찾을 수 없어요" />;
    return (
      <>
        <Link className="back-link" href="/learn">
          ← 팁과 재료 사전
        </Link>
        <PageHeading
          eyebrow="BAKING NOTEBOOK"
          title={tool ? `${tool.name}, 집에 있는 것으로 대신하기` : article?.title ?? ing?.name ?? "대체 안내"}
          description={
            tool ? "어떤 물건으로, 어떤 작업까지 가능한지 먼저 확인하세요." : article?.summary ?? ing?.description ?? ""
          }
        />
        {tool && <ToolAlternatives tool={tool} />}
        <section className="panel article-body">
          <div className="panel-title">
            <Tag>{tool ? "도구 역할과 참고 자료" : article?.category ?? (ing ? "재료 역할" : "도구 안내")}</Tag>
            {!!article?.advanced.length && <button className="chip" onClick={() => setAdvanced(!advanced)}>
              {advanced ? "기본 설명" : "심화 설명 더 보기"}
            </button>}
          </div>
          {tool ? (
            <details><summary>원래 도구의 역할 설명</summary>{(article?.body ?? [tool.description]).map((line, i) => <p key={i}>{line}</p>)}</details>
          ) : article ? (
            article.body.map((line, i) => <p key={i}>{line}</p>)
          ) : ing ? (
            <>
              <h3>이 재료가 하는 일</h3>
              <p>{ing.roles.join(" · ")}</p>
              <p>{ing.description}</p>
              <p>
                기본 단위: {ing.unit}{" "}
                {ing.gramsPerMl
                  ? `· 부피 환산 근거: 1ml당 ${ing.gramsPerMl}g`
                  : ""}
              </p>
              <p>
                표시된 알레르기 관련 성분:{" "}
                {ing.allergens.map(allergenName).join(", ") ||
                  "사전 표기 없음. 제품 성분 확인 필요"}
              </p>
              <img
                className="role-diagram"
                src="/assets/illustrations/ingredient-roles.svg"
                alt="구조, 수분, 지방 등 재료의 여러 역할을 보여주는 그림"
              />
            </>
          ) : (
            <>
              <p>{tool!.description}</p>
              <h3>사용 기능</h3>
              <p>{tool!.capabilities.join(" · ")}</p>
              <p>실제 내열·식품 접촉 조건은 제품 표시를 확인해 주세요.</p>
            </>
          )}
          {article && article.id !== "basic-volume" && <PracticalGuide key={article.id} id={article.id} />}
          {article?.id === "basic-volume" && <CupWorkshop key={boot!.profile.id} />}
          {ing && <div className="space-top"><h3>이 재료의 대체 방법</h3>{c.substitutions.filter(r => r.fromId === ing.id).map(r => <details key={r.id}><summary>{r.description}</summary><p>적용 조건: {r.conditions}</p><p>바꿀 과정: {r.changes}</p><p>주의할 한계: {r.limits}</p></details>)}<Link className="inline-link" href="/lab">레시피를 선택해 대체 배합 확인하기 →</Link></div>}
          {advanced &&
            article?.advanced.map((line, i) => (
              <p className="advanced-note" key={i}>
                {line}
              </p>
            ))}
          {article?.type === "template" && (
            <div className="template-gallery">
              {["heart", "star", "flower", "house"].map((name) => (
                <a
                  key={name}
                  href={`/assets/templates/cookie-${name}.svg`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={`/assets/templates/cookie-${name}.svg`}
                    alt={`${name} 쿠키 자르기 도안`}
                  />
                  <span>도안 열기·인쇄 ↗</span>
                </a>
              ))}
            </div>
          )}
          {article?.type === "template" && (
            <p className="notice">
              출력은 배율 100%로 설정하고 1cm 검정 눈금을 확인하세요. 일반
              종이는 자르기 가이드이며 오븐에 넣지 않습니다.
            </p>
          )}
          <SourceList ids={article?.sourceIds ?? ing?.sourceIds ?? []} />
        </section>
        <div className="section-heading space-top">
          <h2>연결해서 배워봐요</h2>
          <Link href="/recipes">레시피 둘러보기 ↗</Link>
        </div>
        <div className="article-grid">
          {c.recipes
            .filter(
              (r) =>
                article?.recipeIds.includes(r.id) ||
                (ing && r.ingredients.some((i) => i.id === ing.id)) ||
                (tool && r.equipmentIds.includes(tool.id)),
            )
            .slice(0, 6)
            .map((r) => (
              <Link
                className="article-card"
                key={r.id}
                href={`/recipes/${r.id}`}
              >
                <Tag>{categories[r.category]}</Tag>
                <h3>{r.title}</h3>
                <p>{r.description}</p>
              </Link>
            ))}
        </div>
      </>
    );
  }
  const tabs = [
    ["all", "모든 노트"],
    ["ingredient", "재료 사전"],
    ["equipment", "도구 대체"],
    ["technique", "기술과 아이싱"],
    ["troubleshooting", "실패 해결"],
    ["template", "종이 도안"],
  ];
  const items =
    tab === "ingredient"
      ? c.ingredients.map((i) => ({
          id: i.id,
          title: i.name,
          summary: i.description,
          type: "재료 사전",
        }))
      : tab === "equipment"
        ? c.equipment.map((e) => ({
            id: e.id,
            title: e.name,
            summary: e.description,
            type: "도구 안내",
          }))
        : c.articles
            .filter((a) => tab === "all" || a.type === tab)
            .map((a) => ({
              ...a,
              type: tabs.find((t) => t[0] === a.type)?.[1] ?? a.type,
            }));
  const searchable = tab === "all" ? [...items, ...c.ingredients.map(i => ({ id: i.id, title: i.name, summary: `${i.description} ${i.aliases.join(" ")}`, type: "재료 사전" })), ...c.equipment.map(e => ({ id: e.id, title: e.name, summary: e.description, type: "도구 안내" }))] : items;
  const normalized = (s: string) => s.replace(/\s/g, "").toLocaleLowerCase();
  const visible = searchable.filter(i => normalized(i.title + i.summary).includes(normalized(q)));
  return (
    <>
      <PageHeading
        eyebrow="BAKING LIBRARY"
        title="작은 이해가 쌓이는 곳"
        description="재료의 역할부터 도구의 대안까지. 궁금한 순간에 꺼내 보는 베이킹 노트."
      />
      <div className="library-banner">
        <BookOpen size={36} />
        <div>
          <h2>레시피 한 줄 너머의 이유를 배워요.</h2>
          <p>출처와 적용 조건을 확인하고 내 주방에서 한 번씩 경험해 보세요.</p>
        </div>
        <Tag>
          {c.articles.length + c.ingredients.length + c.equipment.length}개의
          노트
        </Tag>
      </div>
      <div className="results-header">
        <div className="category-tabs">
          {tabs.map(([key, name]) => (
            <button
              className={tab === key ? "active" : ""}
              key={key}
              onClick={() => setTab(key)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="search-input">
          <Search size={16} />
          <input
            aria-label="팁 검색"
            placeholder="궁금한 내용 찾기"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <p className="result-count" role="status">{visible.length}개의 자료 · 재료 이름과 별칭도 검색할 수 있어요.</p>
      <div className="article-grid">
        {visible
          .map((item, index) => (
            <Link
              className={`article-card note-${index % 4}`}
              key={item.id}
              href={`/learn/${item.id}`}
            >
              <Tag>{item.type}</Tag>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <ArrowUpRight size={20} />
            </Link>
          ))}
      </div>
      {!visible.length && <Empty title="맞는 자료를 찾지 못했어요" description="더 짧은 단어로 검색하거나 모든 노트로 범위를 넓혀보세요."><button className="button outline" onClick={() => { setQ(""); setTab("all"); }}>검색 초기화</button></Empty>}
    </>
  );
}

// 실수집 자료와 과거 시연 자료를 구분하고 게시일·수집일을 각각 표시합니다.
export function TrendsScreen({ id }: { id?: string }) {
  const { boot, act, refresh } = useLab();
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const data = boot!.trends;
  const item = data.items.find((i: any) => i.id === id);
  async function collect() {
    setBusy(true);
    const run = await act(() => api("admin/trend-runs", {}));
    if (run) {
      await refresh();
      if (run.errors?.length) alert(run.errors.join("\n"));
    }
    setBusy(false);
  }
  if (id && item)
    return (
      <>
        <Link href="/trends" className="back-link">
          ← 트렌드 목록
        </Link>
        <PageHeading
          eyebrow="TREND FIELD NOTES"
          title={item.title}
          description={
            item.description ?? "선택한 공개 출처에서 발견한 베이킹 주제입니다."
          }
        />
        <section className="panel">
          <Tag tone={item.isDemo ? "amber" : "green"}>
            {item.isDemo ? "과거 시연 자료" : "공개 RSS에서 발견"}
          </Tag>
          <p>
            게시일:{" "}
            {item.publishedAt
              ? new Date(item.publishedAt).toLocaleString("ko-KR")
              : "미확인"}
          </p>
          <p>
            {item.isDemo ? "시연 카드 편집일" : "수집일"}:{" "}
            {item.fetchedAt
              ? new Date(item.fetchedAt).toLocaleString("ko-KR")
              : "미확인"}
          </p>
          <a
            className="button outline"
            href={item.sourceUrl ?? item.url}
            target="_blank"
            rel="noreferrer"
          >
            원문 출처 보기 ↗
          </a>
          <h3>우리 집에서는 이렇게 시작해요</h3>
          <p>
            같은 이름의 레시피를 억지로 생성하지 않고, 보유 도구와 재료에 맞는
            쉬운 메뉴부터 찾아보세요.
          </p>
          <Link className="button primary" href="/discover">
            내 주방에 맞춰 찾기
          </Link>
        </section>
        <div className="article-grid space-top">
          {boot!.catalog.recipes
            .filter((r) => (item.recipeIds ?? []).includes(r.id))
            .map((r) => (
              <Link
                className="article-card"
                key={r.id}
                href={`/recipes/${r.id}`}
              >
                <h3>{r.title}</h3>
                <p>{r.description}</p>
              </Link>
            ))}
        </div>
      </>
    );
  return (
    <>
      <PageHeading
        eyebrow="FRESH FROM THE OVEN"
        title="오늘의 베이킹 트렌드는?"
        description="유행을 구경하는 데서 한 발 더. 내 주방에서 해볼 수 있는 아이디어로."
        action={
          <button
            className="button outline"
            disabled={busy || !data.sources.some((s: any) => s.enabled)}
            onClick={collect}
          >
            <RefreshCw size={16} className={busy ? "spin" : ""} />
            {busy ? "자료 수집 중" : "직접 새로 수집"}
          </button>
        }
      />
      <div className={`notice ${data.isDemo ? "" : "green-notice"}`}>
        <strong>
          {data.isDemo
            ? "지금은 과거 시연 자료를 보고 있어요."
            : data.stale
              ? "마지막 수집 후 48시간이 지났어요."
              : "등록한 공개 피드에서 수집한 새 자료예요."}
        </strong>
        <p>
          {data.lastCollectedAt
            ? `마지막 수집 ${new Date(data.lastCollectedAt).toLocaleString("ko-KR")}`
            : "라이브 수집 전입니다."}{" "}
          · 전체 시장 인기 순위나 조회수가 아닌 출처 안에서 발견한 주제예요.
        </p>
        <Link href="/admin">수집원과 연결 상태 관리 →</Link>
      </div>
      <div className="topic-strip">
        {data.topics?.map((t: any) => (
          <div key={t.name}>
            <strong>{t.name}</strong>
            <p>
              최근 7일 {t.current}건 · 이전 7일 {t.previous}건
            </p>
            <Tag>
              {t.baselineComplete
                ? "출처 내 언급 비교"
                : "표본 부족 · 전체 인기 순위 아님"}
            </Tag>
          </div>
        ))}
      </div>
      <div className="search-input narrow">
        <Search size={17} />
        <input
          aria-label="트렌드 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="트렌드 주제 검색"
        />
      </div>
      <div className="trend-grid space-top">
        {data.items
          .filter((i: any) =>
            (i.title + i.description).toLowerCase().includes(q.toLowerCase()),
          )
          .map((i: any, index: number) => (
            <Link
              className={`trend-card trend-${index % 3}`}
              href={`/trends/${i.id}`}
              key={i.id}
            >
              <div className="trend-art">
                <img
                  src={`/assets/illustrations/${["bread", "cookie", "cake", "scone", "nobake", "quick"][index % 6]}.svg`}
                  alt="주제 설명용 직접 제작 삽화"
                />
                <Tag>{i.isDemo ? "시연 사례" : "새로 발견한 주제"}</Tag>
              </div>
              <div>
                <p className="eyebrow">
                  {i.sourceName ?? i.topic ?? "BAKING INSPIRATION"}
                </p>
                <h2>{i.title}</h2>
                <p>
                  {i.description ??
                    "원문과 날짜를 확인하고 관련 아이디어를 살펴보세요."}
                </p>
                <span className="small muted">
                  {i.publishedAt
                    ? new Date(i.publishedAt).toLocaleDateString("ko-KR")
                    : "게시일 미확인"}{" "}
                  <ArrowUpRight size={15} />
                </span>
              </div>
            </Link>
          ))}
      </div>
    </>
  );
}

// 실제 관찰한 값만 남기고, 재고 차감은 미리보기 후 별도로 확정합니다.
export function JournalScreen() {
  const { confirm: askConfirm, prompt: askPrompt, dialog: inputDialog } = useInputDialog();
  const { boot, profileId, save, del, act, notify } = useLab();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [symptom, setSymptom] = useState("");
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const logs = boot!.user.journal;
  const c = boot!.catalog;
  const candidates = symptom
    ? c.articles.filter(
        (a) =>
          a.type === "troubleshooting" &&
          (a.title + a.summary + a.body.join("")).includes(symptom),
      )
    : [];
  async function consume(id: string) {
    const preview = await act(() =>
      api(`inventory-consumptions/preview?profileId=${profileId}`, {
        bakeLogId: id,
      }),
    );
    if (!preview) return;
    const text = preview.changes
      .map(
        (ch: any) =>
          `${c.ingredients.find((i) => i.id === ch.ingredientId)?.name}: ${ch.lots.length}개 재고 수정${ch.missing > 0 ? ` · 부족 ${amount(ch.missing)}` : ""}`,
      )
      .join("\n");
    if (await askConfirm(`다음 재고 차감을 적용할까요?\n${text}`))
      await act(async () => {
        await api(`inventory-consumptions/confirm?profileId=${profileId}`, {
          bakeLogId: id,
          previewToken: preview.previewToken,
        });
        window.location.reload();
      }, "재고를 차감했어요.");
  }
  return (
    <>
      <PageHeading
        eyebrow="MY BAKING JOURNAL"
        title="한 번의 베이킹이 다음의 힌트로"
        description="잘된 점도, 아쉬운 점도 나만의 레시피가 되는 과정이에요."
      />
      {inputDialog}
      <div className="two-column">
        <section className="panel">
          <h2>오늘의 한 줄 기록</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const row = await save("journal", {
                title,
                note,
                date: new Date().toISOString(),
              });
              if (row) {
                setTitle("");
                setNote("");
              }
            }}
          >
            <label className="field">
              무엇을 만들었나요?
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="처음 만든 버터 쿠키"
                maxLength={120}
              />
            </label>
            <label className="field">
              무엇을 관찰했나요?
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="바꾼 재료, 반죽의 상태, 다음에 해보고 싶은 것…"
              />
            </label>
            <button className="button primary">
              기록 남기기 <Plus size={16} />
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>다음에는 무엇을 바꿀까요?</h2>
          <p>원인을 바로 단정하기보다 증상에 맞는 관찰 질문을 찾아봐요.</p>
          <label className="field">
            궁금한 증상
            <input
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              placeholder="예: 퍼짐, 크림, 발효"
            />
          </label>
          {candidates.slice(0, 4).map((a) => (
            <Link className="diagnosis-link" href={`/learn/${a.id}`} key={a.id}>
              {a.title} <ArrowUpRight size={15} />
            </Link>
          ))}
          {symptom && !candidates.length && (
            <p className="muted">
              정확히 맞는 자료가 없어요. 반죽·온도·시간 기록을 더 남겨보세요.
            </p>
          )}
        </section>
      </div>
      <section className="panel space-top">
        <h2>두 번의 시도, 나란히 보기</h2>
        <div className="two-column">
          {[
            [left, setLeft],
            [right, setRight],
          ].map(([value, set], index) => {
            const log = logs.find((l) => l.id === value);
            return (
              <div key={index}>
                <label className="field">
                  {index === 0 ? "첫 번째 기록" : "두 번째 기록"}
                  <select
                    value={value as string}
                    onChange={(e) =>
                      (set as (v: string) => void)(e.target.value)
                    }
                  >
                    <option value="">기록 선택</option>
                    {logs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                </label>
                {log && (
                  <div className="comparison-note">
                    <h3>{log.title}</h3>
                    <p className="pre-wrap">{log.note}</p>
                    <p>
                      온도 {log.temperature ?? "미확인"} · 발효{" "}
                      {log.proofMin ?? "미확인"}분 · 굽기{" "}
                      {log.bakeMin ?? "미확인"}분
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <div className="section-heading space-top">
        <h2>나의 베이킹 {logs.length}번</h2>
        <Link href="/recipes">다음 레시피 찾기 ↗</Link>
      </div>
      <div className="journal-grid">
        {[...logs].reverse().map((log) => (
          <article className="journal-card" key={log.id}>
            <span className="journal-date">
              {new Date(log.date ?? log.createdAt!).toLocaleDateString("ko-KR")}
            </span>
            <h2>{log.title}</h2>
            <p className="pre-wrap">
              {log.note || "과정과 결과를 더 적어보세요."}
            </p>
            {log.photos?.map((id: string) => (
              <img
                className="uploaded-photo"
                key={id}
                src={photoUrl(id, profileId)}
                alt={`${log.title}의 실제 완성 사진`}
              />
            ))}
            <div className="card-tags">
              {log.temperature && <Tag>{log.temperature}°C</Tag>}
              {log.recipeId && <Tag>레시피 스냅샷 보관</Tag>}
            </div>
            <div className="row-actions">
              <button
                className="text-button"
                onClick={async () => {
                  const n = await askPrompt("기록 수정", log.note ?? "");
                  if (n !== null) await save("journal", { ...log, note: n });
                }}
              >
                수정
              </button>
              {log.recipe && (
                <button className="text-button" onClick={() => consume(log.id)}>
                  재고 차감 미리보기
                </button>
              )}
              <button
                className="text-button"
                onClick={() => setDeleteId(log.id)}
              >
                삭제
              </button>
            </div>
          </article>
        ))}
      </div>
      {!logs.length && (
        <Empty
          title="아직 첫 장이 비어 있어요"
          description="레시피에서 만들기를 시작하거나 위에서 한 줄을 적어보세요."
        />
      )}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="이 베이킹 기록을 삭제할까요?">
        <p>선택한 기록이 이 브라우저에서 삭제됩니다. 필요한 기록은 먼저 설정에서 백업하세요.</p>
        <button className="button outline" onClick={() => setDeleteId(null)}>기록 유지</button>
        <button className="button primary" onClick={async () => { if (deleteId) await del("journal", deleteId); setDeleteId(null); }}>선택한 기록 삭제</button>
      </Dialog>
    </>
  );
}

// 예측과 성찰을 기록하는 교육용 과제입니다. 전문 실력 인증을 뜻하지 않습니다.
export function ChallengesScreen() {
  const { boot, save, profileId, act } = useLab();
  const [selected, setSelected] = useState<any>(null);
  const [prediction, setPrediction] = useState("");
  const [reflection, setReflection] = useState("");
  const [logId, setLogId] = useState("");
  const [comparison, setComparison] = useState<any[]>([]);
  const [conTitle, setConTitle] = useState("");
  const [conBody, setConBody] = useState("");
  async function compare() {
    await act(async () => {
      const rows = await api("program-results");
      setComparison(rows);
    });
  }
  return (
    <>
      <PageHeading
        eyebrow="BAKE, TRY, LEARN"
        title="우리들의 작은 베이킹 도전"
        description="다른 도구, 같은 레시피. 서로의 시도에서 새로운 가능성을 발견해요."
      />
      <div className="article-grid">
        {boot!.catalog.challenges.map((ch) => (
          <article className="article-card challenge-card" key={ch.id}>
            <FlaskConical size={24} />
            <h3>{ch.title}</h3>
            <p>{ch.description}</p>
            <button
              className="button outline small-button"
              onClick={() => {
                setSelected(ch);
                setPrediction("");
                setReflection("");
              }}
            >
              도전 기록하기 <ArrowRight size={15} />
            </button>
          </article>
        ))}
      </div>
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title ?? "도전"}
      >
        {selected && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const row = await save("attempts", {
                challengeId: selected.id,
                title: selected.title,
                prediction,
                reflection,
                bakeLogId: logId || null,
                status: "reflected",
              });
              if (row) setSelected(null);
            }}
          >
            <p>{selected.description}</p>
            <label className="field">
              예측해 보기 · {selected.prediction}
              <textarea
                required
                value={prediction}
                onChange={(e) => setPrediction(e.target.value)}
              />
            </label>
            <label className="field">
              연결할 나의 완성 기록
              <select value={logId} onChange={(e) => setLogId(e.target.value)}>
                <option value="">아직 연결하지 않음</option>
                {boot!.user.journal.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              돌아보기 · {selected.reflection}
              <textarea
                required
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
              />
            </label>
            <button className="button primary">도전 과정 저장</button>
            <p className="small muted">
              자료만으로 위험한 재료 대체나 도구 사용을 시도하지 않아요. 전문
              자격 인증이 아닌 학습 기록입니다.
            </p>
          </form>
        )}
      </Dialog>
      <section className="panel space-top">
        <div className="panel-title">
          <h2>{boot!.health.publicDemo ? "나의 도전 기록 비교" : "우리들의 실험 비교"}</h2>
          <button className="button outline small-button" onClick={compare}>
            이 기기의 프로그램 결과 보기
          </button>
        </div>
        <p className="muted">{boot!.health.publicDemo ? "이 주방에 저장한 예측과 성찰을 모아 봅니다. 다른 방문자의 기록과 합산하지 않아요." : "같은 기기의 참가자가 제출한 도전 기록을 보여요. 개인 대화나 사진은 포함하지 않아요."}</p>
        <div className="article-grid">
          {comparison.map((x) => (
            <div className="comparison-note" key={x.id}>
              <Tag>{x.nickname}</Tag>
              <h3>{x.title}</h3>
              <p>예측: {x.prediction}</p>
              <p>성찰: {x.reflection}</p>
            </div>
          ))}
        </div>
        {!comparison.length && <p>아직 표시할 도전 기록이 없어요. 위의 도전에서 예측과 결과를 저장한 뒤 결과 보기 버튼을 눌러주세요.</p>}
      </section>
      <section className="panel space-top">
        <h2>함께 쌓는 베이킹 팁</h2>
        <p>{boot!.health.publicDemo ? "내가 알아낸 방법과 참고 출처를 나의 팁 노트로 남겨요. 다른 사람에게 전송되거나 공개되지 않습니다." : "내가 알아낸 점을 초안으로 제출하면 관리자가 근거와 표현을 검토할 수 있어요."}</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const row = await save("contributions", {
              title: conTitle,
              text: conBody,
              type: "tip",
            });
            if (row) {
              setConTitle("");
              setConBody("");
            }
          }}
        >
          <label className="field">
            팁 제목
            <input
              required
              value={conTitle}
              onChange={(e) => setConTitle(e.target.value)}
            />
          </label>
          <label className="field">
            방법·관찰·참고 출처
            <textarea
              required
              value={conBody}
              onChange={(e) => setConBody(e.target.value)}
            />
          </label>
          <button className="button primary">{boot!.health.publicDemo ? "나의 팁 노트 저장" : "검토할 초안 제출"}</button>
        </form>
        <div className="inventory-list">
          {boot!.user.contributions.map((c) => (
            <div className="inventory-row" key={c.id}>
              <strong>{c.title}</strong>
              <Tag>
                {boot!.health.publicDemo ? "나의 비공개 노트" : c.status === "PUBLISHED" ? "검토 후 공개" : "검토 대기"}
              </Tag>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// 백업 가져오기는 기존 기록을 덮어쓰지 않고 새 ID로 병합합니다.
export function SettingsScreen() {
  const { boot, profileId, setProfile, act, refresh, notify } = useLab();
  const [nickname, setNickname] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [reduced, setReduced] = useState(false);
  async function exportData() {
    const backup = await act(() => api(`export?profileId=${profileId}`));
    if (!backup) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `베이킹랩_백업_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHeading
        eyebrow="WORKSHOP SETTINGS"
        title="내 작업실의 설정"
        description="같은 컴퓨터의 별명 프로필과 기록을 관리합니다. 원격 로그인 계정은 아니에요."
      />
      <div className="two-column">
        <section className="panel">
          <h2>로컬 프로필</h2>
          <p>
            현재: <strong>{boot!.profile.nickname}</strong>
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const p = await act(() => api("profiles", { nickname }));
              if (p) {
                await refresh();
                setProfile(p.id);
                setNickname("");
              }
            }}
          >
            <label className="field">
              새 별명
              <input
                maxLength={30}
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="실명·학교·연락처는 필요 없어요"
              />
            </label>
            <button className="button outline">프로필 추가</button>
          </form>
          <p className="small muted">
            프로필은 같은 기기에 저장돼요. 프로필 선택은 별도의 비밀번호 보호가
            아니에요.
          </p>
          <button
            className="text-button"
            disabled={boot!.profiles.length < 2}
            onClick={async () => {
              if (
                !confirm(
                  "현재 프로필의 재료·기록·수정본·과제·저장 목록을 삭제할까요?",
                )
              )
                return;
              const result = await act(() =>
                api(`profiles/${profileId}`, undefined, "DELETE"),
              );
              if (result)
                setProfile(boot!.profiles.find((p) => p.id !== profileId)!.id);
            }}
          >
            현재 프로필과 연결 기록 삭제
          </button>
        </section>
        <section className="panel">
          <h2>외부 연결 상태</h2>
          <Tag tone={boot!.health.ai ? "green" : "amber"}>
            {boot!.health.ai
              ? "AI 설정됨 · 실제 호출 확인 필요"
              : "AI 설정 필요"}
          </Tag>
          <p>
            AI는 서버 폴더의 <code>.env.local</code>에 <code>AI_API_KEY</code>와{" "}
            <code>AI_MODEL</code>을 넣고 서버를 다시 시작하면 연결할 수 있어요.
          </p>
          <p>
            키는 화면이나 브라우저에 저장하지 않아요. API 이용료가 발생할 수
            있어요. 모델은 자신의 계정에서 사용할 수 있는 이름으로 설정해
            주세요.
          </p>
          <Link href="/admin" className="inline-link">
            프롬프트와 RSS 수집원 관리 ↗
          </Link>
          <hr />
          <label className="check-label">
            <input
              type="checkbox"
              checked={reduced}
              onChange={(e) => {
                setReduced(e.target.checked);
                document.documentElement.classList.toggle(
                  "reduce-motion",
                  e.target.checked,
                );
                localStorage.setItem(
                  "baking-reduce-motion",
                  String(e.target.checked),
                );
                window.dispatchEvent(new Event("baking-motion-change"));
              }}
            />
            움직임 줄이기
          </label>
        </section>
      </div>
      <section className="panel space-top">
        <h2>기록 백업과 가져오기</h2>
        <p>
          기존 자료를 유지하며 새 ID로 병합해요. 사진까지 보관하려면 ZIP 백업을
          선택하세요. JSON은 텍스트 기록만 포함합니다.
        </p>
        <button className="button outline" onClick={exportData}>
          <Download size={16} />내 기록 JSON 내려받기
        </button>
        <button
          className="button outline"
          onClick={async () => {
            const response = await fetch(
              `/api/export?profileId=${profileId}&format=zip`,
            );
            if (!response.ok) {
              notify("백업을 만들지 못했어요.");
              return;
            }
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement("a");
            link.href = url;
            link.download = "베이킹랩_사진포함_백업.zip";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          사진 포함 ZIP 내려받기
        </button>
        <label className="field space-top">
          백업 파일 가져오기
          <input
            type="file"
            accept="application/json,.json,application/zip,.zip"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 20_000_000) {
                notify("20MB 이하 백업만 가져올 수 있어요.");
                return;
              }
              await act(async () => {
                if (file.name.toLowerCase().endsWith(".zip")) {
                  const form = new FormData();
                  form.set("file", file);
                  setPreview(
                    await api(
                      `import/archive-preview?profileId=${profileId}`,
                      form,
                    ),
                  );
                } else
                  setPreview(
                    await api(
                      `import/preview?profileId=${profileId}`,
                      JSON.parse(await file.text()),
                    ),
                  );
              });
            }}
          />
        </label>
        {preview && (
          <div className="notice">
            <h3>가져올 자료 미리보기</h3>
            {Object.entries(preview.counts).map(([key, count]) => (
              <p key={key}>
                {key}: {String(count)}개
              </p>
            ))}
            <p>{preview.notice}</p>
            <button
              className="button primary"
              onClick={async () => {
                const done = await act(
                  () =>
                    api(`import/confirm?profileId=${profileId}`, {
                      previewToken: preview.previewToken,
                    }),
                  "백업을 병합했어요.",
                );
                if (done) {
                  setPreview(null);
                  await refresh();
                }
              }}
            >
              확인하고 병합
            </button>
          </div>
        )}
      </section>
    </>
  );
}

// 공개 전 검토와 프롬프트 버전을 관리하는 로컬 운영자 화면입니다.
export function AdminScreen() {
  const { boot, act, refresh, notify, profileId } = useLab();
  const [tab, setTab] = useState("overview");
  const [admin, setAdmin] = useState<any>(null);
  const [promptName, setPromptName] = useState("나의 베이킹 코치");
  const [promptBody, setPromptBody] = useState("");
  const [sourceName, setSourceName] = useState("Sally의 베이킹 공개 RSS");
  const [sourceUrl, setSourceUrl] = useState(
    "https://sallysbakingaddiction.com/feed/",
  );
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("articles");
  const [json, setJson] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [contributionId, setContributionId] = useState("");
  useEffect(() => {
    api("admin/content")
      .then(setAdmin)
      .catch(() => {});
  }, [boot]);
  async function collect() {
    setBusy(true);
    const run = await act(() => api("admin/trend-runs", {}));
    if (run) {
      notify(
        `수집: ${run.inserted}개 추가, 중복 ${run.duplicates}개${run.errors?.length ? " · 일부 오류 있음" : ""}`,
      );
      await refresh();
    }
    setBusy(false);
  }
  const missing = boot!.catalog.recipes.filter(
    (r) => r.evidence !== "FORMULA_REVIEWED",
  ).length;
  return (
    <>
      <PageHeading
        eyebrow="CONTENT WORKBENCH"
        title="콘텐츠를 가꾸는 작업대"
        description="출처와 근거, 검토 상태를 확인하고 조금씩 채워갑니다."
      />
      <div className="entry-tabs">
        {[
          ["overview", "콘텐츠 현황"],
          ["sources", "RSS 수집원"],
          ["prompts", "AI 프롬프트"],
          ["editor", "콘텐츠 편집"],
        ].map(([id, name]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {name}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <div className="stats-grid">
            {[
              ["레시피", boot!.catalog.recipes.length],
              ["재료", boot!.catalog.ingredients.length],
              ["대체 규칙", boot!.catalog.substitutions.length],
              ["팁과 가이드", boot!.catalog.articles.length],
            ].map(([label, count]) => (
              <div className="panel" key={label}>
                <span>{label}</span>
                <strong className="big-number">{count}</strong>
              </div>
            ))}
          </div>
          <section className="panel space-top">
            <h2>검토가 더 필요한 부분</h2>
            <p>
              응용 배합 {missing}개 · 실제 제조 검증을 하지 않은 콘텐츠는 성공
              보장으로 표시하지 않아요.
            </p>
            <p>자료 출처는 참고용이며 설명·이미지·모델은 직접 작성했습니다.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>초안 제목</th>
                    <th>상태</th>
                    <th>편집</th>
                  </tr>
                </thead>
                <tbody>
                  {admin?.contributions?.map((x: any) => (
                    <tr key={x.id}>
                      <td>{x.title}</td>
                      <td>{x.status}</td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => {
                            setKind("articles");
                            setContributionId(x.id);
                            setJson(
                              JSON.stringify(
                                {
                                  id: crypto.randomUUID(),
                                  title: x.title,
                                  type: "technique",
                                  category: "basic",
                                  summary: x.text.slice(0, 100),
                                  body: [x.text],
                                  advanced: [],
                                  tags: [],
                                  recipeIds: [],
                                  sourceIds: [],
                                },
                                null,
                                2,
                              ),
                            );
                            setTab("editor");
                          }}
                        >
                          검토용 편집
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel space-top">
            <h2>자료 출처</h2>
            <div className="article-grid">
              {boot!.catalog.sources.map((s) => (
                <a
                  className="source-card"
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  key={s.id}
                >
                  <strong>{s.title} ↗</strong>
                  <p>{s.note}</p>
                </a>
              ))}
            </div>
          </section>
        </>
      )}
      {tab === "sources" && (
        <section className="panel">
          <h2>공개 RSS 메타데이터 수집</h2>
          <p>
            제목·링크·날짜만 읽습니다. 원문 레시피·사진을 가져와 콘텐츠로
            게시하지 않아요.
          </p>
          <form
            className="field-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              const result = await act(
                () =>
                  api("admin/trend-sources", {
                    name: sourceName,
                    url: sourceUrl,
                    termsChecked: terms,
                    enabled: true,
                  }),
                "수집원을 등록했어요.",
              );
              if (result) await refresh();
            }}
          >
            <label className="field">
              수집원 이름
              <input
                required
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
              />
            </label>
            <label className="field">
              공개 HTTPS RSS 주소
              <input
                required
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
              />
              공개 피드와 이용 조건을 확인했어요
            </label>
            <button className="button primary" disabled={!terms}>
              수집원 등록
            </button>
          </form>
          <div className="inventory-list">
            {boot!.trends.sources.map((s: any) => (
              <div className="inventory-row" key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <small>{s.url}</small>
                </div>
                <button
                  className="chip"
                  onClick={async () => {
                    await act(() =>
                      api(
                        `admin/trend-sources/${s.id}`,
                        { ...s, enabled: !s.enabled, termsChecked: true },
                        "PATCH",
                      ),
                    );
                    await refresh();
                  }}
                >
                  {s.enabled ? "수집 켜짐" : "수집 꺼짐"}
                </button>
              </div>
            ))}
          </div>
          <button
            className="button outline"
            disabled={busy || !boot!.trends.sources.some((s: any) => s.enabled)}
            onClick={collect}
          >
            <RefreshCw size={16} />
            {busy ? "수집 중" : "지금 직접 수집"}
          </button>
          <p className="small muted">
            최소 1분 간격, 서버의 TRENDS_AUTO=true이면 켜져 있는 동안 KST 06시
            이후 하루 한 번 수집해요.
          </p>
          {boot!.trends.runs.map((r: any) => (
            <div className="run-row" key={r.id}>
              <Tag>{r.status}</Tag>
              <span>
                {new Date(r.createdAt).toLocaleString("ko-KR")} · 추가{" "}
                {r.inserted} · 중복 {r.duplicates}
              </span>
              {r.errors?.map((e: string) => (
                <p className="error-text" key={e}>
                  {e}
                </p>
              ))}
            </div>
          ))}
        </section>
      )}
      {tab === "prompts" && (
        <section className="panel">
          <h2>베이킹 전용 프롬프트 이식</h2>
          <p>
            기본 지침은 유지하면서 나만의 설명 방식과 전문 지침을 새 버전으로
            넣어요. 실제 AI 키가 설정되어야 응답을 확인할 수 있어요.
          </p>
          <div className="prompt-list">
            {admin?.prompts?.map((p: any) => (
              <div className="prompt-card" key={p.id}>
                <div>
                  <Tag tone={p.active ? "green" : ""}>
                    {p.active ? "활성 버전" : "저장된 버전"}
                  </Tag>
                  <h3>{p.name}</h3>
                  <small>{p.id}</small>
                  <details>
                    <summary>본문 확인</summary>
                    <pre>{p.body}</pre>
                  </details>
                </div>
                <button
                  className="button outline small-button"
                  disabled={p.active}
                  onClick={async () => {
                    await act(
                      () => api(`admin/prompts/${p.id}/activate`, {}),
                      "프롬프트 버전을 바꿨어요.",
                    );
                    await refresh();
                  }}
                >
                  이 버전 활성화
                </button>
              </div>
            ))}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const row = await act(
                () =>
                  api("admin/prompts", { name: promptName, body: promptBody }),
                "비활성 초안을 저장했어요. 내용을 확인한 뒤 활성화해 주세요.",
              );
              if (row) {
                setPromptBody("");
                await refresh();
              }
            }}
          >
            <label className="field">
              버전 이름
              <input
                required
                value={promptName}
                onChange={(e) => setPromptName(e.target.value)}
              />
            </label>
            <label className="field">
              프롬프트 파일 가져오기
              <input
                type="file"
                accept=".txt,.md"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f && f.size < 80000) setPromptBody(await f.text());
                  else notify("80KB 이하 텍스트 파일을 선택해 주세요.");
                }}
              />
            </label>
            <label className="field">
              프롬프트 본문
              <textarea
                required
                minLength={20}
                maxLength={20000}
                className="code-input"
                value={promptBody}
                onChange={(e) => setPromptBody(e.target.value)}
              />
            </label>
            <button className="button primary">새 버전 저장</button>
          </form>
        </section>
      )}
      {tab === "editor" && (
        <section className="panel">
          <h2>구조화 콘텐츠 편집</h2>
          <p>
            기존 콘텐츠를 불러와 JSON 형태로 수정할 수 있어요. 원본 시드 대신
            DB에 변경 이력이 저장됩니다.
          </p>
          <div className="field-grid">
            <label className="field">
              콘텐츠 종류
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setJson("");
                }}
              >
                {[
                  "recipes",
                  "articles",
                  "ingredients",
                  "equipment",
                  "substitutions",
                  "challenges",
                ].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label className="field">
              기존 항목 불러오기
              <select
                defaultValue=""
                key={kind}
                onChange={(e) => {
                  const item = (boot!.catalog as any)[kind].find(
                    (x: any) => x.id === e.target.value,
                  );
                  if (item) setJson(JSON.stringify(item, null, 2));
                }}
              >
                <option value="">선택하세요</option>
                {(boot!.catalog as any)[kind].map((x: any) => (
                  <option key={x.id} value={x.id}>
                    {x.title ?? x.name ?? x.description}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              저장 상태
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="DRAFT">초안</option>
                <option value="REVIEW_PENDING">검토 대기</option>
                <option value="PUBLISHED">근거 확인 후 공개</option>
              </select>
            </label>
          </div>
          <label className="field">
            콘텐츠 JSON
            <textarea
              className="code-input tall"
              value={json}
              onChange={(e) => setJson(e.target.value)}
            />
          </label>
          <button
            className="button primary"
            onClick={() =>
              act(async () => {
                const payload = JSON.parse(json);
                await api("admin/content", {
                  kind,
                  contentId: payload.id,
                  payload,
                  status,
                  contributionId: contributionId || undefined,
                });
                await refresh();
                notify("변경 내용을 저장했어요.");
              })
            }
          >
            검증하고 저장
          </button>
        </section>
      )}
    </>
  );
}

// API 키는 이 화면에 오지 않습니다. 질문과 동의만 로컬 서버에 전달합니다.
export function AiPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { boot, profileId, act, notify } = useLab();
  const { language, t } = useLocale();
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [navigation, setNavigation] = useState<ReturnType<typeof siteActions>[number] | null>(null);
  async function submit() {
    if (!text.trim() || busy || !consent || !boot!.health.ai) return;
    await answerQuestion(text);
  }
  async function answerQuestion(message: string) {
    setText("");
    setMessages((m) => [...m, { role: "user", answer: message }]);
    setBusy(true);
    const recipeId = window.location.pathname.startsWith("/recipes/")
      ? window.location.pathname.split("/")[2]
      : undefined;
    try {
      const response = await api(`ai/chat?profileId=${profileId}`, {
        message,
        sessionId,
        recipeId,
        consent,
        language,
        history: messages.filter(m => m.role === "user" || m.role === "assistant").slice(-6).map(m => ({ role: m.role, content: String(m.answer).slice(0, 5000) })),
      });
      setMessages((m) => [...m, { role: "assistant", ...response }]);
      // 입력 중에는 안내하지 않습니다. 답변이 도착한 뒤에만 이동 여부를 물어봅니다.
      setNavigation(replyNavigation(message, response.refs ?? [], boot!.catalog));
    } catch (error) {
      setText(message);
      setMessages((m) => [
        ...m,
        {
          role: "error",
          answer: error instanceof Error ? error.message : "요청을 완료하지 못했어요. 다시 시도해 주세요.",
        },
      ]);
    } finally { setBusy(false); }
  }
  function voice() {
    const Constructor =
      (window as any).SpeechRecognition ??
      (window as any).webkitSpeechRecognition;
    if (!Constructor) {
      notify("이 브라우저는 음성 입력을 지원하지 않아요. 직접 입력해 주세요.");
      return;
    }
    const recognition = new Constructor();
    recognition.lang = language === "en" ? "en-US" : language === "ja" ? "ja-JP" : "ko-KR";
    recognition.onresult = (e: any) => setText(e.results[0][0].transcript);
    recognition.onerror = () =>
      notify("마이크를 사용할 수 없어요. 직접 입력해 주세요.");
    recognition.start();
  }
  return (
    <aside className="ai-panel" aria-label="베이킹 AI 코치">
      <Dialog open={!!navigation} title={navigation?.id.startsWith("equipment:") ? "도구 페이지로 이동할까요?" : navigation?.id.startsWith("recipe:") ? "레시피 페이지로 이동할까요?" : "관련 페이지로 이동할까요?"} onClose={() => setNavigation(null)}>
        <p>질문과 관련된 사이트 안내가 있어요.</p><strong>{navigation && t(navigation.title)}</strong><p>{navigation?.description}</p>
        <div className="row-actions"><button className="button outline" onClick={() => setNavigation(null)}>답변 계속 보기</button><button className="button primary" onClick={() => { if (!navigation) return; const href = navigation.href; setNavigation(null); onClose(); router.push(href); }}>이동하기</button><button className="text-button" onClick={() => setNavigation(null)}>취소</button></div>
      </Dialog>
      <div className="ai-heading">
        <div>
          <Sparkles size={20} />
          <strong>베이킹 코치</strong>
          <Tag tone={boot!.health.ai ? "green" : "amber"}>
            {boot!.health.ai ? "외부 API" : "설정 필요"}
          </Tag>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="AI 코치 닫기"
        >
          <X size={20} />
        </button>
      </div>
      <div className="ai-messages">
        {!boot!.health.ai ? (
          <div className="ai-welcome">
            <Sparkles size={34} />
            <h3>키를 연결하면 대화를 시작해요</h3>
            <p>
              {boot!.health.publicDemo ? "제작자가 Render → Environment에 GEMINI_API_KEY를 넣고 재배포하면 활성화됩니다. API 키를 이 대화창에 입력하지 마세요." : "서버의 .env.local에 GEMINI_API_KEY를 입력하고 다시 실행해 주세요. 기존 OpenAI 설정도 사용할 수 있어요."}
            </p>
            <p>키 없이도 추천·계산·팁·3D·기록 기능은 사용할 수 있어요.</p>
            <Link href="/settings" onClick={onClose}>
              설정 안내 보기 →
            </Link>
          </div>
        ) : messages.length === 0 ? (
          <div className="ai-welcome">
            <Sparkles size={34} />
            <h3>궁금한 순간, 함께 생각해요</h3>
            <p>
              지금 보는 레시피와 사이트의 자료를 찾아 설명해요. 계량·원가는
              계산기를 이용해 주세요.
            </p>
            {[
              "이 레시피에서 버터는 어떤 역할을 해?",
              "쿠키가 많이 퍼졌을 때 무엇을 기록하면 좋을까?",
            ].map((q) => (
              <button
                className="suggested-question"
                key={q}
                onClick={() => setText(q)}
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div className={`chat-message ${m.role}`} key={i}>
            <span>{m.role === "user" ? "나" : "베이킹 코치"}</span>
            <p className="pre-wrap">{m.answer}</p>
            {m.responseKind && (
              <Tag
                tone={
                  m.responseKind === "GROUNDED_GUIDANCE" ? "green" : "amber"
                }
              >
                {m.responseKind === "GROUNDED_GUIDANCE"
                  ? t("자료 근거가 있는 설명")
                  : t("근거 추가 확인 필요")}
              </Tag>
            )}
            {m.refs?.map((r: any) => (
              <Link
                href={
                  boot!.catalog.recipes.some((x) => x.id === r.id)
                    ? `/recipes/${r.id}`
                    : `/learn/${r.id}`
                }
                className="chat-source"
                onClick={onClose}
                key={r.id}
              >
                {t(r.title)} ↗
              </Link>
            ))}
            {m.actions && <AiPageLinks actions={m.actions} onNavigate={onClose} />}
            {m.uncertainties?.map((s: string) => (
              <p className="small muted" key={s}>
                {s}
              </p>
            ))}
            {m.questions?.map((q: string) => <button key={q} className="suggested-question" onClick={() => setText(q)}>{q}</button>)}
          </div>
        ))}
        {busy && <p className="muted">자료를 찾아 설명하고 있어요…</p>}
      </div>
      <form
        className="ai-composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="check-label small">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          질문·최근 대화·현재 원본 레시피와 참고 자료를 {boot!.health.aiProvider ?? "Google Gemini"}로 전송하는 데 동의해요. API 사용료가 발생할 수 있어요.
        </label>
        <div>
          <textarea
            aria-label="AI 코치 질문"
            value={text}
            maxLength={4000}
            onChange={(e) => setText(e.target.value)}
            placeholder="궁금한 점을 적어주세요"
          />
          <button
            type="button"
            className="icon-button"
            aria-label="음성으로 질문 입력"
            onClick={voice}
          >
            <Mic size={18} />
          </button>
          <button
            className="send-button"
            aria-label="질문 보내기"
            disabled={!consent || busy || !text.trim() || !boot!.health.ai}
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </aside>
  );
}
