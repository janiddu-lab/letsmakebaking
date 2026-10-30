"use client";
import { useEffect, useState, useRef } from "react";
import { api, useLab } from "./context";
import { Empty, PageHeading, Tag } from "./ui";

export default function SocialTrends() {
  const { act, boot } = useLab();
  const readOnly = !!boot?.health.publicDemo;
  const canCollect = !readOnly || !!boot?.health.publicCollection;
  const [collectionCode, setCollectionCode] = useState("");
  const collectionHeaders: Record<string, string> = readOnly ? { "x-collection-code": collectionCode } : {};
  const [data, setData] = useState<any>(null);
  const [platforms, setPlatforms] = useState(["bluesky", "youtube", "instagram"]);
  const [instagramUrls, setInstagramUrls] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectionKind, setSelectionKind] = useState<"product" | "hashtag">("product");
  const [loadError, setLoadError] = useState("");
  const [job, setJob] = useState<any>(null);
  const [periodView, setPeriodView] = useState<"week" | "today">("week");
  const [postQuery, setPostQuery] = useState("");
  const [postPlatform, setPostPlatform] = useState("all");
  const [visibleCount, setVisibleCount] = useState(30);
  useEffect(() => setVisibleCount(30), [selected, periodView, postQuery, postPlatform]);
  const continueRef = useRef(false);
  useEffect(() => {
    api("features/social")
      .then((value) => { setData(value); setJob(value.job); })
      .catch((e) => setLoadError(e.message ?? "수집 설정을 읽지 못했어요. 새로고침해 주세요."));
    return () => { continueRef.current = false; };
  }, []);
  async function collect() {
    setBusy(true);
    setLoadError("");
    continueRef.current = true;
    try {
      let value = await api("features/social/start", {
        platforms, instagramUrls: instagramUrls.split(/\s+/).map((s) => s.trim()).filter(Boolean),
      }, "POST", collectionHeaders);
      setJob(value.job);
      while (continueRef.current && value.job.status === "running") {
        await new Promise((resolve) => setTimeout(resolve, 1600));
        if (!continueRef.current) break;
        value = await api("features/social/step", { jobId: value.job.id }, "POST", collectionHeaders);
        setJob(value.job);
      }
      if (value.job.status !== "running") {
        setData(await api("features/social"));
        setSelected(null);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "수집을 이어가지 못했어요. 저장된 작업은 다시 이어갈 수 있습니다.");
    } finally { setBusy(false); continueRef.current = false; }
  }
  async function finishCollection() {
    const value = await act(() => api("features/social/step", { jobId: job.id, stop: true }, "POST", collectionHeaders));
    if (value) { setJob(value.job); setData(await api("features/social")); }
  }
  const baseRun = data?.run;
  const run = baseRun && periodView === "today" && baseRun.today ? { ...baseRun, ...baseRun.today, since: baseRun.todaySince ?? new Date(`${baseRun.day}T00:00:00+09:00`).toISOString() } : baseRun;
  const keywordPosts = selected
    ? run?.posts.filter((p: any) =>
        (selectionKind === "product" ? run.keywords : run.hashtags ?? [])
          .find((k: any) => k.keyword === selected)
          ?.postIds.includes(p.id),
      )
    : run?.posts;
  const posts = keywordPosts?.filter((p: any) => (postPlatform === "all" || p.platform === postPlatform) && p.text.toLocaleLowerCase().includes(postQuery.trim().toLocaleLowerCase()));
  return (
    <>
      <PageHeading
        eyebrow="WHAT'S BAKING ON SOCIAL?"
        title="요즘 어떤 디저트가 눈에 띌까?"
        description="상단에서는 디저트 제품명을, 하단에서는 해시태그를 살펴봐요. 실제 수집한 게시물과 원문을 함께 표시합니다."
      />
      <section className="social-hero">
        <div>
          <span className="sticker-label">DISCOVER YOUR NEXT DESSERT.</span>
          <h2>
            오늘의 베이킹
            <br />
            트렌드는?
          </h2>
          <p>최근 7일 · 고유 게시물 2,000개 목표 · 오늘 자료 별도 집계</p>
          {readOnly && canCollect && <label>
            <strong>수집 접근 코드</strong>
            <input type="password" autoComplete="off" maxLength={256} value={collectionCode} onChange={(e) => setCollectionCode(e.target.value)} disabled={busy} placeholder="관리자가 발급한 코드를 입력하세요" />
            <small>코드를 가진 사람만 새 수집을 실행할 수 있어요. 코드 없이도 기존 결과는 볼 수 있습니다.</small>
          </label>}
          <button
            className="button primary trend-trigger"
            disabled={!canCollect || (readOnly && !collectionCode) || busy || !data || !platforms.length}
            onClick={collect}
          >
            {!canCollect ? "공유용 데모 · 아래의 수집 결과를 확인하세요" : busy
              ? `수집 중 · ${job?.collected ?? 0} / 2,000개`
              : job?.status === "running" ? "저장한 2,000개 수집 이어가기 ↗" : "최근 7일 베이킹 트렌드 모으기 ↗"}
          </button>
        </div>
        <div className="social-graphic">
          <span>어떤 디저트?</span>
          <span>제품명 발견</span>
          <span>오늘은 뭘 굽지</span>
          <b>↗</b>
        </div>
      </section>
      {job && <section className="notice" aria-live="polite">
        <strong>중복 제거 {job.collected.toLocaleString()} / {job.target.toLocaleString()}개 · {job.day} 자료 {job.todayCount.toLocaleString()}개</strong>
        <div><progress value={Math.min(job.collected, job.target)} max={job.target} aria-label="게시물 수집 진행률" /></div>
        <p>조회 {job.requests}회 · 남은 검색 작업 {job.remainingTasks}개 · {job.status === "target_reached" ? "목표 달성" : job.status === "insufficient" ? "공개 검색 결과·조회 제한으로 목표 미달" : job.status === "stopped" ? "현재 자료로 마무리" : busy ? "수집 중" : "이어가기 대기"}</p>
        {busy && <button className="button" onClick={() => { continueRef.current = false; }}>이번 조회 후 일시 정지</button>}
        {!busy && job.status === "running" && <button className="button" onClick={finishCollection}>현재 모인 자료로 분석 마무리</button>}
        <p className="small">이 화면을 떠나면 다음 묶음 조회가 멈춥니다. 진행 상태는 서버에 저장되어 이어갈 수 있어요. 목표보다 적게 모이면 실제 수량과 이유를 표시합니다. 출처별로 2,000개씩을 보장하는 기능은 아닙니다.</p>
        {job.errors?.slice(-3).map((message: string) => <p key={message} className="small">{message}</p>)}
        {job.notes?.slice(-3).map((message: string) => <p key={message} className="small">{message}</p>)}
      </section>}
      {loadError && <p className="notice error">{loadError}</p>}
      <div className="platform-options">
        {data?.connections.map((p: any) => (
          <label
            className={`platform-option ${!p.configured ? "unconnected" : ""}`}
            key={p.id}
          >
            <input
              type="checkbox"
              checked={platforms.includes(p.id)}
              disabled={!canCollect || !p.configured || busy}
              onChange={() =>
                setPlatforms(
                  platforms.includes(p.id)
                    ? platforms.filter((x) => x !== p.id)
                    : [...platforms, p.id],
                )
              }
            />
            <strong>{p.name}</strong>
            <Tag tone={p.configured ? "green" : "amber"}>
              {p.configured ? "키 없이 수집" : "연결 설정 필요"}
            </Tag>
            <small>{p.note}</small>
          </label>
        ))}
      </div>
      {platforms.includes("instagram") && <label className="space-top">
        <strong>선택: Instagram 공개 게시물 링크 (최대 8개, 줄마다 하나)</strong>
        <textarea
          value={instagramUrls}
          onChange={(e) => setInstagramUrls(e.target.value)}
          disabled={busy}
          rows={3}
          placeholder="https://www.instagram.com/p/게시물코드/"
        />
        <small>비워 두면 베이킹 해시태그 공개 페이지를 읽어요. 링크를 넣으면 해당 게시물만 수집하므로 전체 Instagram 유행을 대표하지 않습니다.</small>
      </label>}
      <p className="notice">
        YouTube·Instagram은 API 키 없이 공개 HTML을 읽습니다. 로그인·차단 화면이나
        캡션·게시 시각이 없는 페이지는 제외해요. Instagram은 공개 페이지에서도 게시물을
        제공하지 않을 수 있어 수집 성공을 보장하지 않습니다. Bluesky는 공개 API를 사용해요.
      </p>
      {run ? (
        <>
          <div className="platform-options" aria-label="분석 기간">
            <button className={`button ${periodView === "week" ? "primary" : ""}`} onClick={() => { setPeriodView("week"); setSelected(null); }}>최근 7일 자료</button>
            <button className={`button ${periodView === "today" ? "primary" : ""}`} disabled={!baseRun.today} onClick={() => { setPeriodView("today"); setSelected(null); }}>{baseRun.isStale ? `${baseRun.day} 하루 자료` : "그중 오늘 자료"}</button>
          </div>
          {baseRun.isStale && <p className="notice">마지막 수집 기준일은 {baseRun.day}입니다. 저장된 결과를 보여주고 있으며 현재 시점의 트렌드로 새로 수집한 자료는 아닙니다.</p>}
          <p className="small muted">{baseRun.target ? `주간 자료 ${baseRun.posts.length.toLocaleString()}개 / 목표 ${baseRun.target.toLocaleString()}개 · ${baseRun.targetReached ? "목표 달성" : "목표 미달"}` : "이전 단기 수집 자료입니다. 새 주간 수집을 시작하면 7일 자료로 바뀝니다."}</p>
          <div className="social-summary">
            <div>
              <strong>{run.posts.length}</strong>
              <span>중복 제거 게시물</span>
            </div>
            <div>
              <strong>{run.authors}</strong>
              <span>확인 가능한 작성자</span>
            </div>
            <div>
              <strong>{run.keywords.length}</strong>
              <span>발견한 디저트 제품명</span>
            </div>
            <div>
              <strong>{run.platforms.length}</strong>
              <span>선택 기간에 포함된 SNS</span>
            </div>
          </div>
          {(baseRun.instagramObserved?.length ?? 0) > 0 && <p className="notice">Instagram 공개 캡션 {baseRun.instagramObserved.length}개를 읽었어요. 이 중 최근 7일 집계에 포함된 게시물은 {baseRun.posts.filter((p: any) => p.platform === "instagram").length}개예요. 수집 여부와 날짜 범위는 다르게 표시합니다.</p>}
          <p className="small muted">
            범위 {new Date(run.since).toLocaleString("ko-KR")} ~{" "}
            {new Date(run.until).toLocaleString("ko-KR")} · 수집{" "}
            {new Date(run.collectedAt).toLocaleString("ko-KR")}
          </p>
          {run.errors.length > 0 && (
            <div className="notice error">
              {run.errors.map((e: string) => (
                <p key={e}>{e}</p>
              ))}
              {run.status === "failed" && !run.instagramObserved?.length && (
                <p>이번 수집은 실패했어요. 예시 게시물로 채우지 않았습니다.</p>
              )}
            </div>
          )}
          {(run.status === "no_recent_posts" || (!run.posts.length && run.instagramObserved?.length > 0)) && <p className="notice">공개 게시물은 읽었지만 최근 7일에 포함되는 자료가 없어요. 아래 Instagram 관찰 목록에서 게시 날짜를 확인할 수 있어요.</p>}
          {(run.notes?.length ?? 0) > 0 && <div className="notice">{run.notes.map((note: string) => <p key={note}>{note}</p>)}</div>}
          <h2 className="space-top">{periodView === "today" ? baseRun.isStale ? baseRun.day : "오늘" : "수집 기간"} 자료에 등장한 디저트</h2>
          <p className="small muted">본문과 제목의 제품명을 집계해요. 별칭은 하나로 묶으며, 이름 사전에 있다는 이유만으로 순위에 넣지 않습니다. 현재 표본의 언급순이며 상승세나 전국 유행을 뜻하지 않아요.</p>
          <div className="keyword-wall">
            {run.keywords.map((k: any, i: number) => (
              <button
                key={k.keyword}
                className={`keyword-sticker sticker-${i % 4} ${selectionKind === "product" && selected === k.keyword ? "selected" : ""}`}
                onClick={() => {
                  setSelected(selectionKind === "product" && selected === k.keyword ? null : k.keyword);
                  setSelectionKind("product");
                }}
              >
                <small>{String(i + 1).padStart(2, "0")}</small>
                <strong>{k.keyword}</strong>
                <span>
                  {k.count}개 게시물 · {k.authors}명 확인
                </span>
              </button>
            ))}
          </div>
          {run.keywords.length === 0 && (
            <Empty
              title="선택한 기간의 표본에서 디저트 제품명을 찾지 못했어요"
              description="일반 단어를 제품명 순위에 넣지 않습니다. 아래 수집 게시물과 해시태그를 확인해 주세요."
            />
          )}
          <h2 className="space-top">
            {selected ? `${selectionKind === "hashtag" ? "#" : ""}${selected}의 근거 게시물` : "수집한 공개 게시물"}
          </h2>
          <div className="field-grid"><label className="field">게시물 내용 검색<input value={postQuery} onChange={e => setPostQuery(e.target.value)} placeholder="제품명이나 재료를 입력하세요" /></label><label className="field">SNS 선택<select value={postPlatform} onChange={e => setPostPlatform(e.target.value)}><option value="all">전체 SNS</option><option value="bluesky">Bluesky</option><option value="youtube">YouTube</option><option value="instagram">Instagram</option></select></label></div>
          <p role="status">조건에 맞는 게시물 {(posts?.length ?? 0).toLocaleString()}개 · 최신 수집 표본 안에서 검색합니다.</p>
          <div className="social-posts">
            {posts?.slice(0, visibleCount).map((p: any) => (
              <article key={p.id}>
                <div>
                  <Tag>{p.platform}</Tag>
                  <span>{p.timePrecision === "relative"
                    ? `${p.timeLabel} · 공개 페이지 상대 시각 / 추정`
                    : p.timePrecision === "day" ? `${p.timeLabel} · 공개 페이지 날짜 / 시각·시간대 미확인`
                    : new Date(p.publishedAt).toLocaleString("ko-KR")}</span>
                </div>
                <p>
                  {p.text.slice(0, 160)}
                  {p.text.length > 160 ? "…" : ""}
                </p>
                <a href={p.url} target="_blank" rel="noreferrer">
                  SNS 원문 보기 ↗
                </a>
              </article>
            ))}
          </div>
          {!posts?.length && <Empty title="조건에 맞는 게시물이 없어요" description="검색어나 SNS 선택을 바꾸면 나머지 수집 자료를 볼 수 있어요." />}
          {(posts?.length ?? 0) > visibleCount && <button className="button outline" onClick={() => setVisibleCount(n => n + 30)}>30개 더 보기 · 현재 {visibleCount}개 표시</button>}
          <p className="small muted">
            {run.notice} 빈도는 게시물당 한 번 계산하며 같은 문장의 재게시도
            제거합니다. 검색 결과의 일부만 수집하므로 전체 SNS의 유행을 대표하지
            않습니다.
          </p>
          {(run.productCandidates?.length ?? 0) > 0 && <details className="space-top">
            <summary>새 제품명 자동 발견 후보 · 이름 확인 필요</summary>
            <p className="small muted">본문에서 제품명처럼 보이는 표현을 추출했어요. 새 제품인지 확인되지 않아 위 제품명 순위에는 넣지 않았습니다.</p>
            {run.productCandidates.map((item: any) => <div key={item.keyword}>
              <strong>{item.keyword}</strong> · {item.count}개 게시물
              {run.posts.filter((p: any) => item.postIds.includes(p.id)).slice(0, 2).map((p: any) => <p key={p.id}><a href={p.url} target="_blank" rel="noreferrer">발견 근거 보기 ↗</a></p>)}
            </div>)}
          </details>}
          <section className="space-top" aria-label="해시태그 순위">
            <h2>함께 뜬 해시태그</h2>
            <p className="small muted">제과·제빵 관련 태그만 표시합니다. 게임·성인 홍보·청소·일반 요리·일상 태그는 제외합니다.</p>
            <div className="keyword-wall">
              {(run.hashtags ?? []).map((tag: any, i: number) => <button
                key={tag.keyword}
                className={`keyword-sticker sticker-${i % 4} ${selectionKind === "hashtag" && selected === tag.keyword ? "selected" : ""}`}
                onClick={() => { setSelected(selectionKind === "hashtag" && selected === tag.keyword ? null : tag.keyword); setSelectionKind("hashtag"); }}
              >
                <strong>#{tag.keyword}</strong><span>{tag.count}개 게시물 · {tag.authors}명 확인</span>
              </button>)}
            </div>
          {run.filteredOut > 0 && <p className="small muted">저장 자료에서 관련 없는 게시물 {run.filteredOut}개를 제외하고 다시 분석했습니다. 이전 수집 수보다 줄어들 수 있습니다.</p>}
          {(run.instagramObserved?.length ?? 0) > 0 && <details className="space-top">
            <summary>Instagram에서 읽은 공개 게시물 {run.instagramObserved.length}개 · 날짜 확인</summary>
            <p className="small muted">실제 읽은 자료입니다. 날짜가 선택 기간 밖이거나 날짜 오차 범위가 기간 경계에 걸치는 게시물은 주간 순위·2,000개 목표에서 제외됩니다.</p>
            <div className="social-posts">{run.instagramObserved.map((p: any) => <article key={p.id}>
              <small>{p.timeLabel ?? new Date(p.publishedAt).toLocaleDateString("ko-KR")} · {run.posts.some((item: any) => item.id === p.id) ? "주간 집계 포함" : "기간 밖 또는 날짜 경계로 주간 집계 제외"}</small>
              <p>{p.text.slice(0, 160)}</p><a href={p.url} target="_blank" rel="noreferrer">Instagram 원문 보기 ↗</a>
            </article>)}</div>
          </details>}
            {!run.hashtags?.length && <p>이 수집 자료에는 확인된 해시태그가 없어요.</p>}
            {selectionKind === "hashtag" && selected && <div className="social-posts">
              {posts?.slice(0, 8).map((p: any) => <article key={p.id}><p>{p.text.slice(0, 160)}</p><a href={p.url} target="_blank" rel="noreferrer">#{selected} 근거 게시물 ↗</a></article>)}
            </div>}
          </section>
        </>
      ) : (
        <Empty
          title="버튼을 누르면 오늘의 수집을 시작해요"
          description="RSS나 과거 시연 자료를 SNS 인기 키워드처럼 보여주지 않습니다."
        />
      )}
      <details className="space-top">
        <summary>수집 방식과 설정 위치</summary>
        <p className="small">
          Bluesky 공개 검색 API, YouTube 공개 검색 HTML, Instagram 공개 해시태그·게시물
          HTML을 사용합니다. 세 서비스 모두 키 입력 없이 시도할 수 있어요. HTML 안의
          JSON을 해석하며 Instagram 브라우저 조회에서는 페이지를 렌더링합니다. 게시 시각이 없거나 기간이
          불확실한 자료는 제외합니다. Instagram은 필요한 경우 Playwright 브라우저로 공개 링크와 상세 캡션을 읽습니다. 로그인·접근 확인이 요구되면 중단합니다.
        </p>
        <p className="small">
          <a href="https://docs.bsky.app/" target="_blank" rel="noreferrer">
            Bluesky 공식 문서 ↗
          </a>{" "}
          ·{" "}
          <a
            href="https://developers.google.com/youtube/v3"
            target="_blank"
            rel="noreferrer"
          >
            YouTube 공식 문서 ↗
          </a>
        </p>
      </details>
    </>
  );
}
