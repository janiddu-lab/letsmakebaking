"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Croissant,
  Search,
  House,
  FlaskConical,
  BookOpen,
  TrendingUp,
  NotebookPen,
  Settings,
  Heart,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Plus,
  Check,
  SlidersHorizontal,
  Timer,
  ChefHat,
  Menu,
  X,
  Calculator as CalculatorIcon,
  Wheat,
  CookingPot,
  CircleHelp,
  Flame,
} from "lucide-react";
import {
  LabProvider,
  useLab,
  api,
  categories,
  money,
  amount,
  statusLabel,
  photoUrl,
  allergenName,
} from "./context";
import { recommendationPantry, exclusionIds, bakeLink, savedCup, preparationChecks } from "@/lib/consumer-flow";
import { KitchenJourney, RecipePreparation, PersonalSettings } from "./ConsumerExperience";
import { LocaleProvider, LanguageSwitcher, PageTranslator, useLocale } from "./Locale";
import { matchesLocalized } from "@/lib/locale";
import { Tag, PageHeading, Empty, RecipeCard, SourceList } from "./ui";
import {
  calculateCost,
  convert,
  panFactor,
  adapt,
  combineForShopping,
} from "@/lib/domain";
import type { Recipe, Pantry } from "@/lib/types";
import { ScienceScreen, OvenSuggestion } from "./ScienceScreens";
import LiveBake from "./LiveBake";
import SocialTrends from "./SocialTrends";
import {
  LabScreen,
  LearnScreen,
  TrendsScreen,
  JournalScreen,
  ChallengesScreen,
  SettingsScreen,
  AdminScreen,
  AiPanel,
} from "./ExtraScreens";
const ModelViewer = dynamic(() => import("./ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="model-loading">입체 베이킹을 준비하고 있어요…</div>
  ),
});
const nav = [
  ["/", "작업실", House],
  ["/discover", "레시피 찾기", Search],
  ["/kitchen", "내 주방", CookingPot],
  ["/science", "베이킹 연구실", FlaskConical],
  ["/autopsy", "실패 역추적", CircleHelp],
  ["/lab", "3D·대체 실험실", Croissant],
  ["/learn", "팁과 재료 사전", BookOpen],
  ["/trends", "오늘의 트렌드", TrendingUp],
  ["/journal", "나의 베이킹 기록", NotebookPen],
] as const;
export default function App() {
  return (
    <LocaleProvider><LabProvider>
      <Shell />
    </LabProvider></LocaleProvider>
  );
}
// 현재 주소에 맞는 화면을 선택하고 공통 메뉴·프로필·AI 패널을 배치합니다.
function Shell() {
  useLocale();
  const pathname = usePathname();
  const scienceTab = useSearchParams().get("tab") ?? "chemistry";
  const { boot, profileId, setProfile } = useLab();
  const [mobile, setMobile] = useState(false);
  const [ai, setAi] = useState(false);
  useEffect(() => setMobile(false), [pathname]);
  let screen;
  if (pathname === "/") screen = <Home />;
  else if (pathname === "/discover" || pathname === "/recipes")
    screen = <Discover listOnly={pathname === "/recipes"} />;
  else if (pathname.startsWith("/recipes/")) {
    const parts = pathname.split("/");
    screen =
      parts[3] === "bake" ? (
        <BakeScreen id={parts[2]} key={parts[2] + profileId} />
      ) : (
        <RecipeDetail id={parts[2]} key={parts[2]} />
      );
  } else if (pathname === "/kitchen") screen = <Kitchen />;
  else if (pathname === "/calculator") screen = <Calculator />;
  else if (pathname === "/science" || pathname === "/autopsy")
    screen = (
      <ScienceScreen
        key={profileId + pathname + scienceTab}
        initial={pathname === "/autopsy" ? "autopsy" : scienceTab}
      />
    );
  else if (pathname === "/models") screen = <ScienceScreen initial="models" />;
  else if (pathname === "/lab") screen = <LabScreen />;
  else if (pathname.startsWith("/learn"))
    screen = <LearnScreen id={pathname.split("/")[2]} />;
  else if (pathname === "/trends") screen = <SocialTrends />;
  else if (pathname.startsWith("/trends/") || pathname.startsWith("/rss"))
    screen = <TrendsScreen id={pathname.split("/")[2]} />;
  else if (pathname === "/journal") screen = <JournalScreen />;
  else if (pathname === "/challenges") screen = <ChallengesScreen />;
  else if (pathname === "/settings") screen = boot?.health.publicDemo ? <PersonalSettings key={profileId} /> : <SettingsScreen />;
  else if (pathname === "/admin") screen = boot?.health.publicDemo ? <Empty title="콘텐츠 관리는 제작자 전용이에요"><Link href="/learn">베이킹 자료 둘러보기 →</Link></Empty> : <AdminScreen />;
  else if (pathname === "/saved") screen = <Saved />;
  else
    screen = (
      <Empty title="이 페이지는 찾을 수 없어요">
        <Link href="/">작업실로 돌아가기</Link>
      </Empty>
    );
  return (
    <>
      <a className="skip" href="#main">
        본문으로 바로가기
      </a>
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Link className="brand" href="/">
          <span className="brand-symbol">
            <Croissant size={25} />
          </span>
          <span>
            우리집 베이킹랩<small>MY LITTLE BAKING LAB</small>
          </span>
        </Link>
        <p className="nav-caption">오늘도, 나만의 한 입을</p>
        <nav>
          {nav.map(([url, label, Icon]) => (
            <Link
              key={url}
              href={url}
              className={
                (url === "/" ? pathname === "/" : pathname.startsWith(url))
                  ? "selected"
                  : ""
              }
            >
              <Icon size={19} />
              {label}
              {url === "/lab" && <span className="new-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-extra">
          <Link href="/calculator">
            <CalculatorIcon size={18} /> 베이킹 계산기
          </Link>
          <Link href="/saved">
            <Heart size={18} /> 저장한 레시피
          </Link>
          <Link href="/challenges">
            <ChefHat size={18} /> 함께하는 도전
          </Link>
        </div>
        <div className="sidebar-note">
          <Wheat size={25} />
          <p>
            대단한 도구가 없어도,
            <br />
            시작할 수 있는 베이킹.
          </p>
          <Link href="/learn">작은 팁부터 만나보기 ↗</Link>
        </div>
        <div className="sidebar-bottom">
          <Link href="/settings">
            <Settings size={17} />
            설정
          </Link>
          {!boot?.health.publicDemo && <Link href="/admin">콘텐츠 관리 ↗</Link>}
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="메뉴 닫기"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="메뉴 열기"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <span className="breadcrumb">
            나의 작은 베이킹 작업실{" "}
            <span>
              / {nav.find(([url]) => url === pathname)?.[1] ?? "만들고 배우기"}
            </span>
          </span>
          <div className="topbar-right">
            <LanguageSwitcher />
            <span className="local-badge">
              <i />
              {boot?.health.publicDemo ? "내 브라우저에 저장" : "로컬 작업실"}
            </span>
            <label className="profile-select">
              <span className="avatar">
                {boot?.profile?.nickname?.slice(0, 1) ?? "나"}
              </span>
              <select
                aria-label="로컬 프로필"
                value={profileId}
                onChange={(e) => setProfile(e.target.value)}
              >
                {boot?.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nickname}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>
        <PageTranslator />
        <main id="main" className="main">
          {boot?.health.publicDemo && <p className="notice">나의 재료·가격·즐겨찾기·사진·완성 기록은 이 브라우저에 저장돼요. <Link href="/settings">기록 백업하기 ↗</Link></p>}
          {boot ? (
            screen
          ) : (
            <div className="loading-page">
              <Croissant size={52} />
              <h2>작업실을 열고 있어요</h2>
              <p>레시피와 도구를 준비하고 있습니다.</p>
            </div>
          )}
        </main>
        <footer>
          우리집 베이킹랩{" "}
          <span>직접 만든 삽화와 3D로 배우는 베이킹 · {boot?.health.publicDemo ? "나의 기록은 이 브라우저에 저장됩니다." : "로컬에 저장됩니다."}</span>
          <Link href="/learn">출처와 콘텐츠 안내 ↗</Link>
        </footer>
      </div>
      {boot && <button
        className="ai-fab"
        onClick={() => setAi(!ai)}
        aria-label="베이킹 AI 코치 열기"
      >
        {ai ? <X size={20} /> : <Sparkles size={20} />}
        <span>베이킹 코치</span>
      </button>}
      {ai && <AiPanel onClose={() => setAi(false)} />}
    </>
  );
}
// 첫 화면의 수량은 실제 콘텐츠와 현재 프로필에서 가져옵니다. 가짜 방문자 수를 넣지 않습니다.
function Home() {
  const { boot } = useLab();
  if (!boot) return null;
  const c = boot.catalog;
  const featured = c.recipes
    .filter((r) => r.evidence === "FORMULA_REVIEWED")
    .filter(
      (r, index, list) =>
        list.findIndex((other) => other.category === r.category) === index,
    )
    .slice(0, 3);
  const fallback = featured.length ? featured : c.recipes.slice(0, 3);
  return (
    <>
      <div className="welcome-line">
        <span>
          <i />
          작은 재료로 만드는 즐거운 발견
        </span>
        <span>FLOUR, BUTTER & A LITTLE CURIOSITY</span>
      </div>
      <KitchenJourney />
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span>✳</span> 내 주방에서 시작하는 베이킹
          </div>
          <h1>
            가진 것으로,
            <br />
            맛있는 가능성을.
          </h1>
          <p>
            남은 버터 조금, 익숙한 숟가락 하나.
            <br />
            지금 내 주방에 맞는 레시피를 함께 찾아봐요.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/discover">
              내 재료로 찾아보기 <ArrowUpRight size={19} />
            </Link>
            <Link className="button light" href="/discover?entry=recipe">
              만들고 싶은 메뉴가 있어요 <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-foot">
            <span>
              <Check size={14} /> 재료와 도구에 맞춘 추천
            </span>
            <span>
              <Check size={14} /> 계산부터 완성 기록까지
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-orbit" />
          <div className="hero-stamp">
            BAKE
            <br />
            YOUR WAY<small>매일 작은 실험</small>
          </div>
          <ModelViewer name="croissant" compact />
          <span className="handwritten">오늘의 가능성을 굴려보세요 ↗</span>
          <div className="floating-label">
            <span>🥐</span>
            <div>
              직접 만져보는 베이킹<small>직접 돌려보는 베이킹 모델</small>
            </div>
          </div>
        </div>
      </section>
      <section className="quick-actions">
        {[
          [
            Wheat,
            "재료를 골라서",
            "지금 있는 것으로 무엇을 만들까?",
            "/discover",
            "peach",
          ],
          [
            CookingPot,
            "전용 도구 없이",
            "집에 있는 도구로 바꿔볼까요?",
            "/learn?type=equipment",
            "sage",
          ],
          [
            FlaskConical,
            "베이킹을 실험해요",
            "왜 달라지는지, 직접 알아봐요.",
            "/lab",
            "lavender",
          ],
        ].map(([Icon, title, desc, url, tone]: any) => (
          <Link href={url} key={title} className={`quick-action ${tone}`}>
            <span className="quick-icon">
              <Icon size={24} />
            </span>
            <div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
            <ArrowUpRight size={20} />
          </Link>
        ))}
      </section>
      <section className="science-shortcuts">
        <Link href="/autopsy">
          <span>🕵️</span>
          <strong>망한 쿠키 구조대</strong>
          <small>실패 역추적하기 ↗</small>
        </Link>
        <Link href="/science?tab=chemistry">
          <span>🧪</span>
          <strong>버터 +20%면?</strong>
          <small>쿠키 화학 만져보기 ↗</small>
        </Link>
        <Link href="/trends">
          <span>📣</span>
          <strong>오늘 SNS는?</strong>
          <small>베이킹 키워드 직접 수집 ↗</small>
        </Link>
      </section>
      <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A LITTLE INSPIRATION</p>
            <h2>오늘은 이런 베이킹 어때요?</h2>
          </div>
          <Link href="/recipes">
            레시피 모두 보기 <ArrowRight size={16} />
          </Link>
        </div>
        <div className="recipe-grid">
          {fallback.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      </section>
      <section className="home-bottom">
        <div className="kitchen-summary">
          <div className="section-heading">
            <h2>내 주방, 한눈에</h2>
            <Link href="/kitchen">관리하기 ↗</Link>
          </div>
          <p>꺼내 둔 재료가 다음 아이디어가 돼요.</p>
          <div className="kitchen-numbers">
            <div>
              <strong>
                {boot.user.pantry.length}
                <small>개</small>
              </strong>
              <span>보유 재료</span>
            </div>
            <div>
              <strong>
                {boot.user.equipment.length}
                <small>개</small>
              </strong>
              <span>함께할 도구</span>
            </div>
            <div>
              <strong>
                {boot.user.journal.length}
                <small>번</small>
              </strong>
              <span>나의 베이킹</span>
            </div>
          </div>
          <Link href="/kitchen" className="button outline small-button">
            <Plus size={16} />내 재료와 도구 등록하기
          </Link>
        </div>
        <div className="learning-note">
          <Tag>작업실의 작은 팁</Tag>
          <h2>
            베이킹의 시작은
            <br />
            비싼 도구보다, 작은 이해.
          </h2>
          <p>재료의 역할을 알고, 내 도구의 가능성을 발견해요.</p>
          <Link href="/learn">
            베이킹 팁 둘러보기 <ArrowUpRight size={18} />
          </Link>
          <Wheat className="note-flour" size={96} />
        </div>
      </section>
      <div className="content-note">
        <span>콘텐츠 작업실</span>
        <p>
          레시피 {c.recipes.length}개 · 재료 {c.ingredients.length}개 · 팁{" "}
          {c.articles.length}개. 출처 대조와 실제 제조 검증을 구분해 안내합니다.
        </p>
      </div>
    </>
  );
}

// 두 출발 방식은 entry 한 값으로 구분합니다. 비활성 모드의 선택을 요청에 섞지 않습니다.
function Discover({ listOnly = false }: { listOnly?: boolean }) {
  const { boot, profileId, act, notify, save } = useLab();
  const c = boot!.catalog;
  const [entry, setEntry] = useState("INGREDIENT_FIRST");
  const [mode, setMode] = useState("PANTRY");
  const [selected, setSelected] = useState<string[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [must, setMust] = useState<string[]>([]);
  const [exclude, setExclude] = useState<string[]>([]);
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([]);
  const [excludeQuery, setExcludeQuery] = useState("");
  const [target, setTarget] = useState(c.recipes[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [maxTime, setMaxTime] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [appliance, setAppliance] = useState("");
  const [exploratory, setExploratory] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    const prior = localStorage.getItem(`baking-search-${profileId}`);
    if (prior) {
      try {
        const s = JSON.parse(prior);
        setEntry(s.entry);
        setMode(s.mode);
        setSelected(s.selected);
        setOwned(s.owned);
        setTarget(s.target);
        setMust(s.must ?? []);
        setExclude(s.exclude ?? []);
        setExcludedAllergens(s.excludedAllergens ?? []);
      } catch {}
    } else setSelected(boot!.user.pantry.map((p) => p.ingredientId));
    const params = new URLSearchParams(window.location.search);
    if (params.get("entry") === "recipe") setEntry("RECIPE_FIRST");
    if (params.get("recipe")) {
      setEntry("RECIPE_FIRST");
      setTarget(params.get("recipe")!);
    }
    setInitialized(true);
  }, [profileId]);
  const toggle = (id: string, values: string[], set: (v: string[]) => void) =>
    set(values.includes(id) ? values.filter((i) => i !== id) : [...values, id]);
  useEffect(() => {
    if (!initialized || listOnly) return;
    localStorage.setItem(
      `baking-search-${profileId}`,
      JSON.stringify({ entry, mode, selected, owned, target, must, exclude, excludedAllergens }),
    );
    setMatching(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const ids =
          entry === "RECIPE_FIRST"
            ? owned
            : mode === "PANTRY"
              ? boot!.user.pantry.map((p) => p.ingredientId)
              : selected;
        const pantry = recommendationPantry(ids, boot!.user.pantry as unknown as Pantry[], c);
        const result = await api(`matches?profileId=${profileId}`, {
          entryMode: entry,
          ingredientMode: entry === "RECIPE_FIRST" ? "PANTRY" : mode,
          allowedIds: [...new Set(ids)],
          mustUseIds: entry === "RECIPE_FIRST" ? [] : must,
          excludedIds: exclusionIds(exclude, excludedAllergens, c),
          pantry,
          equipment: boot!.user.equipment.map((e) => e.equipmentId),
          targetRecipeId: entry === "RECIPE_FIRST" ? target : undefined,
          filters: {
            allowSubstitutions: mode !== "STRICT",
            exploratory,
            ...(maxTime ? { maxTotalMinutes: Number(maxTime) } : {}),
            ...(difficulty ? { maxDifficulty: Number(difficulty) } : {}),
            ...(appliance ? { appliance } : {}),
          },
        });
        if (cancelled) return;
        setResults(result.results);
        setError("");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "조건을 확인해 주세요.");
        setResults([]);
      } finally {
        if (!cancelled) setMatching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [
    entry,
    mode,
    selected,
    owned,
    must,
    exclude,
    excludedAllergens,
    target,
    maxTime,
    difficulty,
    appliance,
    exploratory,
    boot!.user.pantry,
    boot!.user.equipment,
    initialized,
    listOnly,
  ]);
  const targetRecipe = c.recipes.find((r) => r.id === target);
  const activeIds = entry === "RECIPE_FIRST" ? owned : selected;
  const visibleIngredients =
    entry === "RECIPE_FIRST"
      ? c.ingredients.filter((i) =>
          targetRecipe?.ingredients.some((x) => x.id === i.id),
        )
      : c.ingredients.filter((i) =>
          matchesLocalized(i.name, ingredientQuery) || i.aliases.some(a => matchesLocalized(a, ingredientQuery)),
        );
  const cards = listOnly ? c.recipes : results.map((r) => r.recipe);
  const displayed = cards.filter(
    (r) =>
      (category === "all" || r.category === category) &&
      (matchesLocalized(r.title, query) || r.tags.some((tag: string) => matchesLocalized(tag, query))),
  );
  return (
    <>
      <PageHeading
        eyebrow="FIND YOUR NEXT BAKE"
        title={listOnly ? "레시피 보관실" : "무엇으로 시작해 볼까요?"}
        description="가진 재료에서 출발해도, 만들고 싶은 메뉴에서 출발해도 좋아요."
      />
      {!listOnly && (
        <>
          <div className="entry-tabs">
            <button
              className={entry === "INGREDIENT_FIRST" ? "active" : ""}
              onClick={() => setEntry("INGREDIENT_FIRST")}
            >
              <Wheat size={19} />내 재료로 찾기
            </button>
            <button
              className={entry === "RECIPE_FIRST" ? "active" : ""}
              onClick={() => setEntry("RECIPE_FIRST")}
            >
              <Croissant size={19} />
              원하는 레시피에서 시작
            </button>
          </div>
          <div className="discovery-panel">
            <div className="panel-title">
              <h3>
                {entry === "RECIPE_FIRST"
                  ? "만들고 싶은 메뉴와 가진 재료"
                  : "내 주방의 재료를 골라주세요"}
              </h3>
              <Link href="/kitchen">재고와 수량 관리 ↗</Link>
            </div>
            {entry === "RECIPE_FIRST" ? (
              <label className="field">
                만들고 싶은 레시피
                <select
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setOwned([]);
                  }}
                >
                  {c.recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="mode-row">
                {[
                  ["PANTRY", "내 주방에서 가능한 것"],
                  ["STRICT", "선택한 재료만"],
                  ["INCLUDE", "이 재료를 활용"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={`chip ${mode === value ? "chosen" : ""}`}
                    onClick={() => setMode(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {entry === "INGREDIENT_FIRST" && mode === "PANTRY" ? (
              <div className="notice">
                등록한 재료 {boot!.user.pantry.length}개와 도구{" "}
                {boot!.user.equipment.length}개를 기준으로 비교해요.{" "}
                {boot!.user.pantry.length === 0 && (
                  <Link href="/kitchen">내 주방을 먼저 채워주세요 →</Link>
                )}
              </div>
            ) : (
              <>
                <div className="search-input">
                  <Search size={17} />
                  <input
                    aria-label="재료 검색"
                    placeholder="재료 이름 찾기 (예: 버터, 달걀)"
                    value={ingredientQuery}
                    onChange={(e) => setIngredientQuery(e.target.value)}
                  />
                </div>
                <div className="ingredient-picker">
                  {visibleIngredients.slice(0, 80).map((i) => (
                    <button
                      className={`chip ${activeIds.includes(i.id) ? "chosen" : ""}`}
                      key={i.id}
                      onClick={() =>
                        toggle(
                          i.id,
                          activeIds,
                          entry === "RECIPE_FIRST" ? setOwned : setSelected,
                        )
                      }
                    >
                      {activeIds.includes(i.id) ? (
                        <Check size={13} />
                      ) : (
                        <Plus size={13} />
                      )}{" "}
                      {i.name}
                    </button>
                  ))}
                </div>
                <p className="small muted">
                  기본 재료도 자동으로 넣지 않아요. 양이 등록되지 않았다면 보유
                  종류만 비교해요.
                </p>
              </>
            )}
            {entry === "INGREDIENT_FIRST" &&
              mode !== "PANTRY" &&
              selected.length > 0 && (
                <div className="must-use">
                  <span>꼭 사용하기</span>
                  {selected.map((id) => (
                    <label key={id}>
                      <input
                        type="checkbox"
                        checked={must.includes(id)}
                        onChange={() => toggle(id, must, setMust)}
                      />
                      {c.ingredients.find((i) => i.id === id)?.name}
                    </label>
                  ))}
                </div>
              )}
            <details className="filter-details">
              <summary>
                <SlidersHorizontal size={15} />
                시간·난이도·제외 재료 설정
              </summary>
              <div className="field-grid">
                <label className="field">
                  전체 소요 시간
                  <select
                    value={maxTime}
                    onChange={(e) => setMaxTime(e.target.value)}
                  >
                    <option value="">제한 없음</option>
                    <option value="30">30분 이내</option>
                    <option value="60">1시간 이내</option>
                    <option value="120">2시간 이내</option>
                  </select>
                </label>
                <label className="field">
                  최대 난이도
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  >
                    <option value="">전체</option>
                    <option value="1">쉬움</option>
                    <option value="2">보통까지</option>
                  </select>
                </label>
                <label className="field">
                  조리 환경
                  <select
                    value={appliance}
                    onChange={(e) => setAppliance(e.target.value)}
                  >
                    <option value="">전체</option>
                    <option value="oven">오븐</option>
                    <option value="airfryer">에어프라이어</option>
                    <option value="microwave">전자레인지</option>
                    <option value="none">가열 없음</option>
                  </select>
                </label>
              </div>
              <h3>알레르기 관련 성분으로 제외하기</h3>
              <div className="ingredient-picker">{[...new Set(c.ingredients.flatMap(i => i.allergens))].map(id => <button key={id} className={`chip ${excludedAllergens.includes(id) ? "excluded" : ""}`} aria-pressed={excludedAllergens.includes(id)} onClick={() => toggle(id, excludedAllergens, setExcludedAllergens)}>{allergenName(id)} 제외</button>)}</div>
              <label className="field">제외할 재료 검색<input value={excludeQuery} onChange={e => setExcludeQuery(e.target.value)} placeholder="호두, 참깨, 초콜릿…" /></label>
              <div className="ingredient-picker">
                {c.ingredients.filter(i => (i.name + i.aliases.join(" ")).replace(/\s/g, "").includes(excludeQuery.replace(/\s/g, ""))).map((i) => (
                  <button
                    key={i.id}
                    className={`chip ${exclude.includes(i.id) ? "excluded" : ""}`}
                    onClick={() => toggle(i.id, exclude, setExclude)}
                  >
                    제외 {i.name}
                  </button>
                ))}
              </div>
              <label className="check-label small">
                <input
                  type="checkbox"
                  checked={exploratory}
                  onChange={(e) => setExploratory(e.target.checked)}
                />
                검토 전 응용 배합도 탐색하기 (실행 가능 추천과 구분)
              </label>
              <p className="small muted">
                제품의 실제 알레르기 성분과 교차 접촉은 별도로 확인해야 해요.
              </p>
            </details>
            <button
              className="text-button"
              onClick={() =>
                save("settings", {
                  id: `search-${profileId}`,
                  type: "match-session",
                  entry,
                  mode,
                  selected,
                  owned,
                  target,
                  must,
                  exclude,
                  excludedAllergens,
                })
              }
            >
              현재 조건을 주방에 저장
            </button>
          </div>
        </>
      )}
      <div className="results-header">
        <div className="category-tabs">
          {Object.entries(categories).map(([id, name]) => (
            <button
              key={id}
              className={category === id ? "active" : ""}
              onClick={() => setCategory(id)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="search-input compact-search">
          <Search size={16} />
          <input
            aria-label="레시피 검색"
            placeholder="레시피 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <p className="result-count" aria-live="polite">
        {matching
          ? "조건을 비교하고 있어요…"
          : `${displayed.length}개의 레시피`}
        {!listOnly && " · 추천 점수는 성공 확률이 아니에요."}
      </p>
      {error && <div className="notice error">{error}</div>}
      {entry === "RECIPE_FIRST" && !listOnly && (
        <div className="notice">
          <strong>원본 레시피:</strong> {targetRecipe?.title} —{" "}
          {results.find((r) => r.recipe.id === target)?.reasons.join(" · ") ??
            "현재 조건에 맞지 않아요."}
          <br />
          아래의 다른 메뉴는 원본을 바꾼 레시피가 아닌 대안이에요.
        </div>
      )}
      {displayed.length ? (
        <div className="recipe-grid">
          {displayed.map((r) => {
            const match = results.find((x) => x.recipe.id === r.id);
            return (
              <RecipeCard
                key={r.id}
                recipe={r}
                detail={
                  match ? (
                    <>
                      <Tag tone={match.state === "READY" ? "green" : "amber"}>
                        {statusLabel[match.state]}
                      </Tag>
                      <p>{match.reasons.join(" · ")}</p>
                      {match.maxScale > 0 && match.maxScale < 1 && (
                        <p>
                          보유량 기준 최대 {amount(match.maxScale)}배 · 최소
                          배합과 계량 확인 필요
                        </p>
                      )}
                    </>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      ) : (
        !matching && (
          <Empty
            title="현재 조건에 맞는 레시피가 없어요"
            description="허용 재료나 제외 조건을 직접 바꿔보세요. 조건을 자동으로 완화하지 않아요."
          >
            <Link className="button outline" href="/recipes">
              전체 레시피 보기
            </Link>
          </Empty>
        )
      )}
    </>
  );
}

// 재고·도구·구매 가격을 관리합니다. 예시 값은 사용자가 선택한 경우에만 추가됩니다.
function Kitchen() {
  const { boot, save, del, act, refresh, profileId, notify } = useLab();
  const c = boot!.catalog;
  const [ingredient, setIngredient] = useState(c.ingredients[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("g");
  const [expiry, setExpiry] = useState("");
  const [cupMl, setCupMl] = useState(() => String(savedCup(boot!.user.settings)?.ml ?? ""));
  const [q, setQ] = useState("");
  const [priceIngredient, setPriceIngredient] = useState(
    c.ingredients[0]?.id ?? "",
  );
  const [priceQty, setPriceQty] = useState("1000");
  const [price, setPrice] = useState("");
  const [priceUnit, setPriceUnit] = useState("g");
  const [recognition, setRecognition] = useState("");
  async function sample() {
    if (
      !confirm(
        "예시 재료·도구·가격을 기존 자료에 추가할까요? 실제 보유량이 아니며 나중에 수정할 수 있어요.",
      )
    )
      return;
    await act(async () => {
      const recipe =
        c.recipes.find((r) => r.evidence === "FORMULA_REVIEWED") ??
        c.recipes[0];
      for (const i of recipe.ingredients)
        if (!boot!.user.pantry.some((p) => p.ingredientId === i.id)) {
          await api(`state/pantry?profileId=${profileId}`, {
            ingredientId: i.id,
            quantity: i.quantity * 3,
            unit: i.unit,
            isSample: true,
          });
          await api(`state/prices?profileId=${profileId}`, {
            ingredientId: i.id,
            packageQuantity: i.unit === "ea" ? 10 : 1000,
            packageUnit: i.unit,
            packagePrice: i.unit === "ea" ? 4000 : 6000,
            currency: "KRW",
            isSample: true,
          });
        }
      for (const id of recipe.equipmentIds)
        if (!boot!.user.equipment.some((e) => e.equipmentId === id))
          await api(`state/equipment?profileId=${profileId}`, {
            equipmentId: id,
          });
      await refresh();
    }, "예시 주방을 추가했어요. 실제 재료와 가격으로 수정해 주세요.");
  }
  async function scan(file: File) {
    if (
      !confirm(
        "선택한 사진을 설정된 OpenAI API에 보내 후보 이름을 찾을까요? 비용이 발생할 수 있어요.",
      )
    )
      return;
    const form = new FormData();
    form.set("file", file);
    await act(async () => {
      const upload = await api(`uploads?profileId=${profileId}`, form);
      const result = await api(
        `ai/recognize-ingredients?profileId=${profileId}`,
        { uploadId: upload.id, consent: true },
      );
      setRecognition(result.text);
    });
  }
  return (
    <>
      <PageHeading
        eyebrow="MY KITCHEN"
        title="내 주방의 작은 가능성"
        description="가진 재료와 도구를 알려주면, 추천이 나에게 더 가까워져요."
        action={
          <button className="button outline" onClick={sample}>
            예시 주방 추가
          </button>
        }
      />
      <div className="two-column">
        <section className="panel">
          <div className="panel-title">
            <h2>재료 보관함</h2>
            <Tag>{boot!.user.pantry.length}개 보유</Tag>
          </div>
          <form
            className="field-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              const added = await save("pantry", {
                ingredientId: ingredient,
                quantity: quantity === "" ? null : Number(quantity),
                unit,
                cupMl: unit === "cup" && cupMl ? Number(cupMl) : undefined,
                expiryDate: expiry || null,
              });
              if (added) setQuantity("");
            }}
          >
            <label className="field">
              재료
              <select
                value={ingredient}
                onChange={(e) => {
                  setIngredient(e.target.value);
                  setUnit(
                    c.ingredients.find((i) => i.id === e.target.value)?.unit ??
                      "g",
                  );
                }}
              >
                {c.ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              남은 양
              <input
                type="number"
                min="0"
                step="any"
                placeholder="모르면 비워두기"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <label className="field">
              단위
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                {["g", "kg", "ml", "L", "ea", "tsp", "tbsp", "cup"].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            <label className="field">
              기한 날짜 (선택)
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </label>
            <label className="field" hidden={unit !== "cup"}>
              내 컵 용량 (ml)
              <input
                type="number"
                min="1"
                max="2000"
                required={unit === "cup" && quantity !== ""}
                placeholder="실제 용량을 아는 컵만"
                value={cupMl}
                onChange={(e) => setCupMl(e.target.value)}
              />
            </label>
            <button className="button primary" type="submit">
              <Plus size={16} /> 재료 넣기
            </button>
          </form>
          <p className="small muted">
            빈 수량은 양 미확인, 0은 남은 양 없음이에요. 기한은 상태를 보장하지
            않아요.
          </p>
          <div className="inventory-list">
            {boot!.user.pantry.map((p) => (
              <div className="inventory-row" key={p.id}>
                <span className="ingredient-bubble">
                  <Wheat size={17} />
                </span>
                <div>
                  <strong>
                    {c.ingredients.find((i) => i.id === p.ingredientId)?.name ??
                      p.ingredientId}
                  </strong>
                  <small>
                    {amount(p.quantity)} {p.quantity === null ? "" : p.unit}{" "}
                    {p.isSample ? "· 예시 재고" : ""}
                    {p.expiryDate ? ` · ${p.expiryDate}` : ""}
                  </small>
                </div>
                <button
                  className="text-button"
                  onClick={async () => {
                    const n = prompt(
                      "남은 양을 입력하세요. 비워두면 양 미확인입니다.",
                      p.quantity === null ? "" : String(p.quantity),
                    );
                    if (n !== null)
                      await save("pantry", {
                        ...p,
                        quantity: n === "" ? null : Number(n),
                      });
                  }}
                >
                  수정
                </button>
                <button
                  className="icon-button"
                  aria-label={`${p.ingredientId} 삭제`}
                  onClick={() => del("pantry", p.id)}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
          {!boot!.user.pantry.length && (
            <Empty
              title="아직 담긴 재료가 없어요"
              description="첫 재료를 넣고 나만의 베이킹을 시작해 보세요."
            />
          )}
        </section>
        <section className="panel">
          <h2>함께할 도구</h2>
          <p className="muted">실제로 가진 도구와 기기만 골라주세요.</p>
          <div className="equipment-grid">
            {c.equipment.map((tool) => {
              const owned = boot!.user.equipment.find(
                (e) => e.equipmentId === tool.id,
              );
              return (
                <button
                  key={tool.id}
                  className={`equipment-chip ${owned ? "chosen" : ""}`}
                  onClick={() =>
                    owned
                      ? del("equipment", owned.id)
                      : save("equipment", { equipmentId: tool.id })
                  }
                >
                  <span>
                    {owned ? <Check size={17} /> : <Plus size={17} />}
                  </span>
                  {tool.name}
                </button>
              );
            })}
          </div>
          <Link className="inline-link" href="/learn?type=equipment">
            도구가 없다면? 대체 안내 보기 ↗
          </Link>
          <hr />
          {boot!.health.publicDemo ? <><h3>재료 이름이 헷갈리나요?</h3><p>재료 사전에서 별칭·역할·대체 조건을 확인하고 직접 선택할 수 있어요.</p><Link className="button outline" href="/learn?type=ingredient">재료 사전에서 찾기 →</Link></> : <><h3>재료 사진으로 후보 찾기</h3>
          <p className="small muted">
            종류와 수량은 직접 확인해야 해요. AI 키가 설정되어야 사용할 수
            있어요.
          </p>
          <input
            aria-label="재료 사진 선택"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={!boot!.health.ai}
            onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])}
          />
          {recognition && <div className="notice pre-wrap">{recognition}</div>}
          </>}
        </section>
      </div>
      <section className="panel space-top">
        <h2>내가 산 가격</h2>
        <p className="muted">
          사용 원가와 추가 구매 금액을 계산하는 기준이에요. 원화만 지원합니다.
        </p>
        <form
          className="field-grid"
          onSubmit={(e) => {
            e.preventDefault();
            save("prices", {
              ingredientId: priceIngredient,
              packageQuantity: Number(priceQty),
              packagePrice: Number(price),
              packageUnit: priceUnit,
              currency: "KRW",
              purchasedAt: new Date().toISOString(),
              isSample: false,
            });
          }}
        >
          <label className="field">
            재료
            <select
              value={priceIngredient}
              onChange={(e) => {
                setPriceIngredient(e.target.value);
                setPriceUnit(
                  c.ingredients.find((i) => i.id === e.target.value)?.unit ??
                    "g",
                );
              }}
            >
              {c.ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            한 포장 양
            <input
              required
              type="number"
              min="0.001"
              step="any"
              value={priceQty}
              onChange={(e) => setPriceQty(e.target.value)}
            />
          </label>
          <label className="field">
            포장 단위
            <select
              value={priceUnit}
              onChange={(e) => setPriceUnit(e.target.value)}
            >
              {["g", "kg", "ml", "L", "ea"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <label className="field">
            구매 가격 (원)
            <input
              required
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <button className="button primary">가격 저장</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>재료</th>
                <th>포장</th>
                <th>가격</th>
                <th>구분</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {boot!.user.prices.map((p) => (
                <tr key={p.id}>
                  <td>
                    {c.ingredients.find((i) => i.id === p.ingredientId)?.name}
                  </td>
                  <td>
                    {amount(p.packageQuantity)} {p.packageUnit}
                  </td>
                  <td>{money(p.packagePrice)}</td>
                  <td>{p.isSample ? "예시 가격" : "직접 입력"}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => del("prices", p.id)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// 배합 원본은 유지하고 수정 미리보기를 확인한 뒤 별도 버전을 저장합니다.
function RecipeDetail({ id }: { id: string }) {
  const { boot, profileId, act, save, refresh } = useLab();
  const c = boot!.catalog;
  const base = c.recipes.find((r) => r.id === id);
  const [scale, setScale] = useState(1);
  const [advanced, setAdvanced] = useState(false);
  const [ruleIds, setRuleIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<any>(null);
  if (!base) return <Empty title="레시피를 찾을 수 없어요" />;
  const recipe = {
    ...base,
    ingredients: base.ingredients.map((i) => ({
      ...i,
      quantity: i.quantity * scale,
    })),
    yieldCount: base.yieldCount * scale,
  };
  let cost: any;
  try {
    cost = calculateCost(
      base,
      scale,
      boot!.user.prices,
      boot!.user.pantry as unknown as Pantry[],
      c,
    );
  } catch {}
  const rules = c.substitutions
    .filter(
      (r) => r.contexts.includes(base.category) || r.contexts.includes("all"),
    )
    .filter((r) =>
      r.kind === "ingredient"
        ? base.ingredients.some((i) => i.id === r.fromId)
        : base.equipmentIds.includes(r.fromId),
    );
  async function makePreview() {
    const p = await act(() =>
      api(`adaptations/preview?profileId=${profileId}`, {
        recipeId: id,
        ruleIds,
        scale,
      }),
    );
    if (p) setPreview(p);
  }
  return (
    <>
      <Link className="back-link" href="/recipes">
        ← 레시피 보관실
      </Link>
      <div className="recipe-hero">
        <div className={`recipe-big-art theme-${base.category}`}>
          <img
            src={`/assets/illustrations/${base.category}.svg`}
            alt={`${base.title} 설명용 삽화`}
          />
          <span>직접 제작한 설명용 삽화</span>
        </div>
        <div className="recipe-intro">
          <p className="eyebrow">
            {categories[base.category]} · OUR BAKING NOTES
          </p>
          <h1>{base.title}</h1>
          <p>{base.description}</p>
          <div className="card-tags">
            <Tag
              tone={base.evidence === "FORMULA_REVIEWED" ? "green" : "amber"}
            >
              {base.evidence === "FORMULA_REVIEWED"
                ? "출처 배합 대조"
                : "응용 배합 · 제조 전 검토 필요"}
            </Tag>
            <Tag>직접 제조 미검증</Tag>
          </div>
          <div className="recipe-facts">
            <span>
              <ClockIcon />
              전체 {base.totalMin}분
            </span>
            <span>활동 {base.activeMin}분</span>
            <span>난이도 {base.difficulty}</span>
            <span>{amount(recipe.yieldCount)}개</span>
          </div>
          <div className="hero-actions">
            <Link className="button primary" href={`/recipes/${id}/bake?scale=${scale}`}>
              함께 만들어 보기 <ArrowRight size={17} />
            </Link>
            <Link className="button outline" href={`/discover?recipe=${id}`}>
              내 재료로 다시 추천
            </Link>
          </div>
        </div>
      </div>
      <OvenSuggestion recipe={base} />
      <RecipePreparation key={`${id}-${scale}`} recipe={recipe} />
      <div className="recipe-layout">
        <div>
          <section className="panel">
            <div className="panel-title">
              <h2>재료와 계량</h2>
              <label className="inline-field">
                배합 배수{" "}
                <input
                  type="number"
                  min={base.minScale ?? 0.25}
                  max={base.maxScale ?? 4}
                  step="0.25"
                  value={scale}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (value >= (base.minScale ?? .25) && value <= (base.maxScale ?? 4)) { setScale(value); setPreview(null); }
                  }}
                />
              </label>
            </div>
            <div className="ingredient-lines">
              {recipe.ingredients.map((i, index) => {
                const ing = c.ingredients.find((g) => g.id === i.id);
                return (
                  <div key={i.id + index}>
                    <span>
                      {ing?.name ?? i.id}
                      {i.optional && <Tag>선택 장식</Tag>}
                    </span>
                    <strong>
                      {amount(i.quantity)} {i.unit}
                    </strong>
                  </div>
                );
              })}
            </div>
            <p className="muted small">
              달걀 소수량은 무게 환산 근거를 확인해 나누세요. 배수를 바꿔도 굽는
              시간을 같은 비율로 바꾸지 않아요.
            </p>
            {base.unitConvention && <p className="notice small">계량 기준: {base.unitConvention}</p>}
            <Link href={`/calculator?tab=unit&recipe=${base.id}&ingredient=${recipe.ingredients[0].id}&amount=${recipe.ingredients[0].quantity}&from=${recipe.ingredients[0].unit}`} className="inline-link">
              컵·숟가락·팬 크기 계산하기 ↗
            </Link>
          </section>
          <section className="panel space-top">
            <div className="panel-title">
              <h2>만드는 과정</h2>
              <button className="chip" onClick={() => setAdvanced(!advanced)}>
                {advanced ? "기본 설명 보기" : "더 깊이 알아보기"}
              </button>
            </div>
            <ol className="steps">
              {base.steps.map((step, index) => (
                <li key={index}>
                  <span className="step-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p>{step.text}</p>
                    {step.check && (
                      <div className="step-check">
                        <Check size={14} />
                        {step.check}
                      </div>
                    )}
                    {advanced && (
                      <p className="advanced-note">{step.advanced}</p>
                    )}
                    {!!step.timerMin && (
                      <Tag>{step.timerMin}분 참고 타이머</Tag>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <SourceList ids={base.sourceIds} />
        </div>
        <aside>
          <section className="panel">
            <h3>준비할 도구</h3>
            <div className="tool-list">
              {base.equipmentIds.map((e) => (
                <span key={e}>
                  {boot!.user.equipment.some((o) => o.equipmentId === e) ? (
                    <Check size={15} />
                  ) : (
                    <Plus size={15} />
                  )}{" "}
                  {c.equipment.find((t) => t.id === e)?.name ?? e}
                </span>
              ))}
            </div>
            <Link href="/kitchen" className="inline-link">
              내 도구 등록하기 ↗
            </Link>
          </section>
          <section className="panel space-top">
            <h3>이번 베이킹의 원가</h3>
            <div className="cost-total">
              {money(cost?.lines.some((l: any) => l.cost !== null) ? cost.total : null)}
              <small>
                {cost?.incomplete
                  ? "가격 확인된 재료의 부분합"
                  : "재료 사용 원가"}
              </small>
            </div>
            <p>
              개당 {money(cost?.lines.some((l: any) => l.cost !== null) ? cost.perItem : null)}
              {cost?.incomplete ? " (부분합 기준)" : ""}
            </p>
            <p>
              추가 구매{" "}
              {cost?.additionalIncomplete
                ? "미확인 항목 있음"
                : money(cost?.additional)}
            </p>
            <Link href="/kitchen" className="inline-link">
              구매 가격 입력하기 ↗
            </Link>
          </section>
          <section className="panel space-top">
            <h3>내 주방에 맞게 바꾸기</h3>
            <p className="small muted">
              원본은 그대로 두고 새 수정본을 만들어요. 조건과 한계를 함께 확인해
              주세요.
            </p>
            {rules.slice(0, 12).map((r) => (
              <label className="rule-option" key={r.id}>
                <input
                  type="checkbox"
                  checked={ruleIds.includes(r.id)}
                  onChange={() => {
                    setRuleIds(
                      ruleIds.includes(r.id)
                        ? ruleIds.filter((x) => x !== r.id)
                        : [...ruleIds, r.id],
                    );
                    setPreview(null);
                  }}
                />
                <span>
                  {r.description}
                  <small>{r.conditions}</small>
                </span>
              </label>
            ))}
            <button className="button outline full-width" onClick={makePreview}>
              수정안 미리보기
            </button>
            {preview && (
              <div className="notice">
                <strong>{preview.status}</strong>
                {preview.changes.map((s: string) => (
                  <p key={s}>{s}</p>
                ))}
                {preview.warnings.map((s: string) => (
                  <p key={s}>{s}</p>
                ))}
                <button
                  className="button primary small-button"
                  onClick={async () => {
                    const saved = await act(
                      () =>
                        api(`recipe-versions?profileId=${profileId}`, {
                          previewId: preview.previewId,
                          label: `${base.title} ${scale}배 수정본`,
                        }),
                      "새 수정본을 저장했어요.",
                    );
                    if (saved) await refresh();
                  }}
                >
                  수정본 저장
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>
      <section className="home-section">
        <div className="section-heading">
          <h2>함께 읽으면 좋은 팁</h2>
          <Link href="/learn">모든 팁 ↗</Link>
        </div>
        <div className="article-grid">
          {c.articles
            .filter((a) => a.recipeIds.includes(id) || a.category === "basic")
            .slice(0, 3)
            .map((a) => (
              <Link className="article-card" key={a.id} href={`/learn/${a.id}`}>
                <Tag>{a.category}</Tag>
                <h3>{a.title}</h3>
                <p>{a.summary}</p>
                <ArrowUpRight size={20} />
              </Link>
            ))}
        </div>
      </section>
    </>
  );
}
function ClockIcon() {
  return <Timer size={15} />;
}

// 화면용 계산도 서버와 동일한 함수를 사용하므로 양쪽 계산식이 어긋나지 않습니다.
function Calculator() {
  const { boot, act } = useLab();
  const params = useSearchParams();
  const c = boot!.catalog;
  const [tab, setTab] = useState(["cost", "shopping", "scale", "pan", "unit"].includes(params.get("tab") ?? "") ? params.get("tab")! : "cost");
  const [basket, setBasket] = useState<string[]>([]);
  const [recipeId, setRecipeId] = useState(c.recipes.find(r => r.id === params.get("recipe"))?.id ?? c.recipes[0].id);
  const [scale, setScale] = useState(1);
  const [extras, setExtras] = useState(0);
  const [shape, setShape] = useState("round");
  const [oldWidth, setOldWidth] = useState(20);
  const [newWidth, setNewWidth] = useState(10);
  const [oldHeight, setOldHeight] = useState(20);
  const [newHeight, setNewHeight] = useState(20);
  const [ingredient, setIngredient] = useState(c.ingredients.find(i => i.id === params.get("ingredient"))?.id ?? c.ingredients[0].id);
  const [value, setValue] = useState(params.get("amount") ?? "100");
  const [from, setFrom] = useState(params.get("from") ?? "g");
  const [to, setTo] = useState(params.get("to") ?? "cup");
  const [cup, setCup] = useState(() => String(savedCup(boot!.user.settings)?.ml ?? ""));
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => { setResult(null); setErr(""); }, [tab, recipeId, scale, shape, oldWidth, newWidth, oldHeight, newHeight, ingredient, value, from, to, cup]);
  const recipe =
    tab === "shopping" && basket.length
      ? combineForShopping(
          c.recipes.filter((r) => basket.includes(r.id)),
          c,
        )
      : c.recipes.find((r) => r.id === recipeId)!;
  let cost: any;
  let costError = "";
  try {
    cost = calculateCost(
      recipe,
      tab === "shopping" ? 1 : scale,
      boot!.user.prices,
      boot!.user.pantry as unknown as Pantry[],
      c,
      extras,
    );
  } catch (e) { costError = e instanceof Error ? e.message : "계산 입력을 확인하세요."; }
  function doCalc() {
    try {
      setErr("");
      if (tab === "pan")
        setResult({
          value: panFactor(
            { shape, width: oldWidth, height: oldHeight },
            { shape, width: newWidth, height: newHeight },
          ),
          unit: "배",
          note: "같은 반죽 두께 기준의 배합 계수입니다. 굽는 시간과 온도는 자동 조정하지 않아요.",
        });
      else if (tab === "scale")
        setResult({
          value: amount(recipe.yieldCount * scale),
          unit: "개 (계획)",
          items: adapt(recipe, [], c, scale).recipe.ingredients,
        });
      else {
        if ((from === "cup" || to === "cup") && (!cup || !Number.isFinite(Number(cup)) || Number(cup) < 10 || Number(cup) > 2000)) throw new Error("내 컵의 확인한 용량을 10~2,000ml로 입력하세요.");
        setResult({
          value: amount(convert(
            value,
            from,
            to,
            c.ingredients.find((i) => i.id === ingredient),
            Number(cup) || 240,
          )),
          unit: to,
          note: "해당 재료의 환산 근거가 있는 경우만 계산해요. 실제 담는 방식에 따라 차이가 있을 수 있어요.",
        });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "입력을 확인해 주세요.");
      setResult(null);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="BAKING CALCULATORS"
        title="작은 숫자가 만드는 차이"
        description="사용한 만큼의 원가와, 실제 장보기에 쓸 금액을 구분해 보세요."
      />
      <div className="entry-tabs">
        {[
          ["cost", "원가와 장보기"],
          ["shopping", "여러 메뉴 장보기"],
          ["scale", "분량 조정"],
          ["pan", "틀 크기 변환"],
          ["unit", "단위와 달걀 환산"],
        ].map(([id, name]) => (
          <button
            className={tab === id ? "active" : ""}
            key={id}
            onClick={() => {
              setTab(id);
              setResult(null);
              setErr("");
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <section className="panel">
        {tab === "shopping" && (
          <>
            <h3>각 메뉴 한 배합씩 합쳐서 장보기</h3>
            <div className="ingredient-picker">
              {c.recipes.map((r) => (
                <button
                  className={`chip ${basket.includes(r.id) ? "chosen" : ""}`}
                  key={r.id}
                  onClick={() =>
                    setBasket(
                      basket.includes(r.id)
                        ? basket.filter((id) => id !== r.id)
                        : [...basket, r.id],
                    )
                  }
                >
                  {r.title}
                </button>
              ))}
            </div>
            {!basket.length && (
              <p className="notice">
                합산할 메뉴를 한 개 이상 선택하세요. 선택 전에는 장보기 금액을 계산하지 않습니다.
              </p>
            )}
          </>
        )}
        <div className="field-grid">
          {(tab === "cost" || tab === "scale") && (
            <>
              <label className="field">
                레시피
                <select
                  value={recipeId}
                  onChange={(e) => setRecipeId(e.target.value)}
                >
                  {c.recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                배합 배수
                <input
                  type="number"
                  min={recipe.minScale ?? .25}
                  max={recipe.maxScale ?? 4}
                  step="0.25"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                />
              </label>
            </>
          )}
          {(tab === "cost" || tab === "shopping") && (
            <label className="field">
              포장·전기·기타 비용 합계 (원)
              <input
                type="number"
                min="0"
                value={extras}
                onChange={(e) => setExtras(Number(e.target.value))}
              />
            </label>
          )}
          {tab === "pan" && (
            <>
              <label className="field">
                팬 모양
                <select
                  value={shape}
                  onChange={(e) => setShape(e.target.value)}
                >
                  <option value="round">원형</option>
                  <option value="rect">직사각형</option>
                </select>
              </label>
              <label className="field">
                원래 {shape === "round" ? "지름" : "가로"} (cm)
                <input
                  type="number"
                  min="1"
                  value={oldWidth}
                  onChange={(e) => setOldWidth(Number(e.target.value))}
                />
              </label>
              {shape === "rect" && (
                <label className="field">
                  원래 세로 (cm)
                  <input
                    type="number"
                    min="1"
                    value={oldHeight}
                    onChange={(e) => setOldHeight(Number(e.target.value))}
                  />
                </label>
              )}
              <label className="field">
                내 팬 {shape === "round" ? "지름" : "가로"} (cm)
                <input
                  type="number"
                  min="1"
                  value={newWidth}
                  onChange={(e) => setNewWidth(Number(e.target.value))}
                />
              </label>
              {shape === "rect" && (
                <label className="field">
                  내 팬 세로 (cm)
                  <input
                    type="number"
                    min="1"
                    value={newHeight}
                    onChange={(e) => setNewHeight(Number(e.target.value))}
                  />
                </label>
              )}
            </>
          )}
          {tab === "unit" && (
            <>
              <label className="field">
                재료
                <select
                  value={ingredient}
                  onChange={(e) => setIngredient(e.target.value)}
                >
                  {c.ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                수량
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
              <label className="field">
                기존 단위
                <select value={from} onChange={(e) => setFrom(e.target.value)}>
                  {["g", "kg", "ml", "L", "ea", "tsp", "tbsp", "cup"].map(
                    (u) => (
                      <option key={u}>{u}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="field">
                바꿀 단위
                <select value={to} onChange={(e) => setTo(e.target.value)}>
                  {["g", "kg", "ml", "L", "ea", "tsp", "tbsp", "cup"].map(
                    (u) => (
                      <option key={u}>{u}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="field">
                내 컵 용량 (ml)
                <input
                  type="number"
                  min="1"
                  value={cup}
                  onChange={(e) => setCup(e.target.value)}
                />
              </label>
              <p className="small muted">{savedCup(boot!.user.settings) ? `저장한 컵: ${savedCup(boot!.user.settings)!.name}` : "내 컵 용량은 임의의 기본값으로 채우지 않아요."} <Link href="/learn/basic-volume">컵 용량 확인·등록하기 →</Link></p>
            </>
          )}
        </div>
        {tab !== "cost" && tab !== "shopping" && (
          <button className="button primary" onClick={doCalc}>
            계산하기 <ArrowRight size={16} />
          </button>
        )}
        {err && <div className="notice error">{err}</div>}
        {result && (
          <div className="calculation-result">
            <strong>
              {result.value} <small>{result.unit}</small>
            </strong>
            <p>{result.note}</p>
            {result.items?.map((i: any) => (
              <p key={i.id}>
                {c.ingredients.find((x) => x.id === i.id)?.name}:{" "}
                {amount(i.quantity)} {i.unit}
              </p>
            ))}
          </div>
        )}
        {(tab === "cost" || tab === "shopping") && costError && <p className="notice error">{costError}</p>}
        {(tab === "cost" || (tab === "shopping" && basket.length > 0)) && cost && (
          <>
            <div className="cost-summary-grid">
              <div>
                <span>
                  {cost.incomplete
                    ? "확인된 사용 원가 부분합"
                    : "배치 사용 원가"}
                </span>
                <strong>{money(cost.lines.some((l: any) => l.cost !== null) || extras > 0 ? cost.total : null)}</strong>
                <small>이미 가진 재료도 포함</small>
              </div>
              <div>
                <span>
                  {tab === "shopping" ? "선택한 메뉴" : "개당 원가"}
                  {tab !== "shopping" && cost.incomplete ? " (부분합)" : ""}
                </span>
                <strong>{tab === "shopping" ? `${basket.length}개 메뉴` : money(cost.lines.some((l: any) => l.cost !== null) || extras > 0 ? cost.perItem : null)}</strong>
                <small>
                  {tab === "shopping"
                    ? "서로 다른 메뉴의 개당 평균은 계산하지 않아요."
                    : `계획 생산량 ${amount(recipe.yieldCount * scale)}개 기준`}
                </small>
              </div>
              <div>
                <span>
                  추가 구매 지출
                  {cost.additionalIncomplete ? " (확인된 항목)" : ""}
                </span>
                <strong>{money(cost.lines.some((l: any) => l.purchase !== null) ? cost.additional : null)}</strong>
                <small>판매 포장 단위로 계산</small>
              </div>
            </div>
            {cost.incomplete && (
              <div className="notice">
                가격이 없는 재료가 있어 총액이 완성되지 않았어요.{" "}
                <Link href="/kitchen">내 주방에서 가격 입력 →</Link>
              </div>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>재료</th>
                    <th>필요한 양</th>
                    <th>사용 원가</th>
                    <th>부족량</th>
                    <th>구매 포장</th>
                    <th>추가 지출</th>
                  </tr>
                </thead>
                <tbody>
                  {cost.lines.map((line: any) => (
                    <tr key={line.id}>
                      <td>
                        {c.ingredients.find((i) => i.id === line.id)?.name}
                      </td>
                      <td>
                        {amount(line.amount)} {line.unit}
                      </td>
                      <td>{money(line.cost)}</td>
                      <td>
                        {amount(line.missing)} {line.unit}
                      </td>
                      <td>
                        {line.packs === null
                          ? "양·가격 미확인"
                          : `${line.packs}개`}
                      </td>
                      <td>{money(line.purchase)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted">
              기본 예시 가격은 실제 시세가 아닙니다. 여러 메뉴 합산 시에는 같은
              재료의 부족량을 먼저 합쳐야 해요.
            </p>
            <button className="button outline" onClick={() => window.print()}>
              계산 결과 인쇄
            </button>
          </>
        )}
      </section>
    </>
  );
}

// 만들기 진행과 타이머의 종료 시각을 저장해 새로고침해도 이어갈 수 있게 합니다.
function BakeScreen({ id }: { id: string }) {
  const { boot, profileId, save, act, refresh, notify } = useLab();
  const params = useSearchParams();
  const original = boot!.catalog.recipes.find((r) => r.id === id);
  const version = boot!.user.versions.find(
    (v) => v.id === params.get("version") && v.recipeId === id,
  );
  const requestedScale = Number(params.get("scale") ?? 1);
  const scale = Number.isFinite(requestedScale) && requestedScale >= (original?.minScale ?? .25) && requestedScale <= (original?.maxScale ?? 4) ? requestedScale : 1;
  const recipe = (version?.recipe ?? (original ? { ...original, yieldCount: original.yieldCount * scale, ingredients: original.ingredients.map(i => ({ ...i, quantity: i.quantity * scale })) } : original)) as Recipe;
  const sessionId = `bake-${profileId}-${id}-${version?.id ?? `original-${scale}`}-${params.get("run") ?? "active"}`;
  const saved = boot!.user.sessions.find((s) => s.id === sessionId);
  const [step, setStep] = useState(saved?.step ?? 0);
  const [note, setNote] = useState(saved?.note ?? "");
  const [timers, setTimers] = useState<any[]>(saved?.timers ?? []);
  const [now, setNow] = useState(Date.now());
  const [photo, setPhoto] = useState<string | null>(null);
  const [temp, setTemp] = useState("");
  const [proof, setProof] = useState("");
  const [baked, setBaked] = useState("");
  const [checks, setChecks] = useState<string[]>(saved?.checks ?? (recipe ? preparationChecks(boot!.user.settings, recipe) : []));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!original) return <Empty title="레시피를 찾을 수 없어요"><Link href="/recipes">다른 레시피 찾기 →</Link></Empty>;
  async function persist(
    nextStep = step,
    nextTimers = timers,
    nextChecks = checks,
  ) {
    await api(`state/sessions?profileId=${profileId}`, {
      id: sessionId,
      recipeId: id,
      versionId: version?.id ?? null,
      run: params.get("run"),
      recipe,
      scale,
      step: nextStep,
      note,
      timers: nextTimers,
      checks: nextChecks,
      status: "in-progress",
    });
  }
  async function finish() {
    const log = await save("journal", {
      id: sessionId,
      title: `${recipe.title} 만들기`,
      recipeId: id,
      recipe: structuredClone(recipe),
      note,
      photos: photo ? [photo] : [],
      temperature: temp ? Number(temp) : null,
      proofMin: proof ? Number(proof) : null,
      bakeMin: baked ? Number(baked) : null,
      plannedYield: recipe.yieldCount,
      result: "완성 기록",
      date: new Date().toISOString(),
    });
    if (log) {
      await save("sessions", {
        id: sessionId,
        recipeId: id,
        step,
        note,
        timers,
        status: "finished",
      });
      notify(
        "완성 기록을 저장했어요. 내 기록에서 비교하고 재고를 차감할 수 있어요.",
      );
    }
  }
  async function upload(file: File) {
    const form = new FormData();
    form.set("file", file);
    const image = await act(() => api(`uploads?profileId=${profileId}`, form));
    if (image) setPhoto(image.id);
  }
  return (
    <>
      <PageHeading
        eyebrow="BAKE WITH ME"
        title={recipe.title}
        description="서두르지 않아도 괜찮아요. 한 단계씩 확인하며 만들어봐요."
        action={
          <Link className="button outline" href={`/recipes/${id}`}>
            레시피 전체 보기
          </Link>
        }
      />
      <OvenSuggestion recipe={recipe} />
      {scale !== 1 && !version && <p className="notice">현재 원본의 {amount(scale)}배 · 계획 {amount(recipe.yieldCount)}개입니다. 굽는 시간·온도는 자동으로 늘리지 않습니다. 원래 틀 크기와 반죽 높이를 확인하고 필요하면 여러 팬에 나눠 굽거나 <Link href="/science?tab=pan">팬 환산</Link>을 확인하세요.</p>}
      <LiveBake key={sessionId} recipe={recipe} sessionId={sessionId} />
      <div className="bake-layout">
        <section className="panel bake-stage">
          <div className="bake-progress">
            {recipe.steps.map((_, i) => (
              <button
                className={i === step ? "active" : i < step ? "done" : ""}
                key={i}
                aria-label={`${i + 1}단계로 이동`}
                onClick={() => {
                  setStep(i);
                  act(() => persist(i));
                }}
              >
                {i < step ? <Check size={15} /> : i + 1}
              </button>
            ))}
          </div>
          <p className="eyebrow">
            STEP {step + 1} OF {recipe.steps.length}
          </p>
          <h2>{recipe.steps[step]?.text}</h2>
          {recipe.steps[step]?.check && (
            <div className="notice">
              <Check size={18} />
              {recipe.steps[step].check}
            </div>
          )}
          <details>
            <summary>이 단계는 왜 필요할까요?</summary>
            <p>{recipe.steps[step]?.advanced}</p>
          </details>
          {!!recipe.steps[step]?.timerMin && (
            <button
              className="button outline"
              onClick={() => {
                const next = [
                  ...timers,
                  {
                    id: crypto.randomUUID(),
                    label: `${step + 1}단계`,
                    endAt: Date.now() + recipe.steps[step].timerMin! * 60000,
                  },
                ];
                setTimers(next);
                act(() => persist(step, next));
              }}
            >
              <Timer size={18} />
              {recipe.steps[step].timerMin}분 타이머 시작
            </button>
          )}
          <div className="bake-navigation">
            <button
              className="button outline"
              disabled={step === 0}
              onClick={() => {
                setStep(step - 1);
                act(() => persist(step - 1));
              }}
            >
              이전 단계
            </button>
            <button
              className="button primary"
              disabled={step === recipe.steps.length - 1}
              onClick={() => {
                setStep(step + 1);
                act(() => persist(step + 1));
              }}
            >
              다음 단계 <ArrowRight size={18} />
            </button>
          </div>
          <label className="field">
            만들면서 관찰한 점
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => act(() => persist())}
              placeholder="반죽 상태, 바꾼 재료, 다음에 기억할 점을 적어주세요."
            />
          </label>
          <div className="field-grid">
            <label className="field">
              설정 온도 (°C)
              <input
                type="number"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                placeholder="측정·설정한 값만"
              />
            </label>
            <label className="field">
              실제 발효 시간 (분)
              <input
                type="number"
                min="0"
                value={proof}
                onChange={(e) => setProof(e.target.value)}
              />
            </label>
            <label className="field">
              실제 굽기 시간 (분)
              <input
                type="number"
                min="0"
                value={baked}
                onChange={(e) => setBaked(e.target.value)}
              />
            </label>
          </div>
          <label className="field">
            완성 사진 (선택)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>
          {photo && (
            <img
              className="uploaded-photo"
              src={photoUrl(photo!, profileId)}
              alt="내 완성 사진"
            />
          )}
          <button className="button primary" onClick={finish}>
            <Check size={17} />
            완성 기록 저장
          </button>
          <p className="small muted">
            완성 기록 저장만으로 재고가 차감되지는 않아요. 같은 만들기를
            저장하면 현재 기록이 갱신돼요.
          </p>
          <button
            className="button outline"
            onClick={() => {
              window.location.href = bakeLink(id, { run: crypto.randomUUID(), versionId: version?.id, scale });
            }}
          >
            별도의 새 시도 시작
          </button>
        </section>
        <aside>
          <section className="panel">
            <h3>재료 체크</h3>
            {recipe.ingredients.map((i) => (
              <label className="bake-ingredient" key={i.id}>
                <input
                  type="checkbox"
                  checked={checks.includes(i.id)}
                  onChange={() => {
                    const next = checks.includes(i.id)
                      ? checks.filter((x) => x !== i.id)
                      : [...checks, i.id];
                    setChecks(next);
                    act(() => persist(step, timers, next));
                  }}
                />
                {boot!.catalog.ingredients.find((g) => g.id === i.id)?.name}
                <strong>
                  {amount(i.quantity)} {i.unit}
                </strong>
              </label>
            ))}
          </section>
          <section className="panel space-top">
            <h3>진행 중인 타이머</h3>
            {timers.length === 0 ? (
              <p className="muted">필요한 단계에서 타이머를 시작해 주세요.</p>
            ) : (
              timers.map((t) => {
                const seconds =
                  t.pausedSeconds ??
                  Math.max(0, Math.ceil((t.endAt - now) / 1000));
                return (
                  <div className="timer-row" key={t.id}>
                    <div>
                      <span>{t.label}</span>
                      <strong role="timer">
                        {seconds
                          ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
                          : "시간이 되었어요"}
                      </strong>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        const next = timers.map((x) =>
                          x.id !== t.id
                            ? x
                            : t.pausedSeconds !== undefined
                              ? {
                                  ...t,
                                  endAt: Date.now() + t.pausedSeconds * 1000,
                                  pausedSeconds: undefined,
                                }
                              : { ...t, pausedSeconds: seconds },
                        );
                        setTimers(next);
                        act(() => persist(step, next));
                      }}
                    >
                      {t.pausedSeconds !== undefined ? "계속" : "멈춤"}
                    </button>
                    <button
                      className="icon-button"
                      aria-label="타이머 삭제"
                      onClick={() => {
                        const next = timers.filter((x) => x.id !== t.id);
                        setTimers(next);
                        act(() => persist(step, next));
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })
            )}
            <p className="small muted">
              브라우저를 닫으면 알림은 울리지 않아요. 다시 열면 남은 시간을
              복원해요.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
// 폴더를 지워도 레시피 원본은 지워지지 않습니다. 개인의 저장 관계만 바꿉니다.
function Saved() {
  const { boot, save, del } = useLab();
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("all");
  const rows = boot!.user.saved.filter(
    (s) => folder === "all" || s.collectionId === folder,
  );
  return (
    <>
      <PageHeading
        eyebrow="MY RECIPE BOX"
        title="다음에 만들고 싶은 한 입"
        description="저장해 둔 레시피를 폴더로 정리해 보세요."
      />
      <div className="panel">
        <div className="field-grid">
          <label className="field">
            저장 폴더
            <select value={folder} onChange={(e) => setFolder(e.target.value)}>
              <option value="all">전체 저장 레시피</option>
              {boot!.user.collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            새 폴더 이름
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button
            className="button outline"
            disabled={!name.trim()}
            onClick={async () => {
              await save("collections", { name: name.trim() });
              setName("");
            }}
          >
            폴더 추가
          </button>
        </div>
        {folder !== "all" && (
          <button
            className="text-button"
            onClick={async () => {
              await del("collections", folder);
              setFolder("all");
            }}
          >
            이 폴더 삭제 (레시피는 유지)
          </button>
        )}
      </div>
      <div className="recipe-grid space-top">
        {rows.map((s) => {
          const recipe = boot!.catalog.recipes.find((r) => r.id === s.recipeId);
          return recipe ? (
            <div key={s.id}>
              <RecipeCard recipe={recipe} />
              <label className="field small">
                폴더 이동
                <select
                  value={s.collectionId ?? ""}
                  onChange={(e) =>
                    save("saved", {
                      ...s,
                      collectionId: e.target.value || null,
                    })
                  }
                >
                  <option value="">분류 없음</option>
                  {boot!.user.collections.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null;
        })}
      </div>
      {!rows.length && (
        <Empty title="다음에 만들 레시피를 담아보세요">
          <Link href="/recipes" className="button primary">
            레시피 찾아보기
          </Link>
        </Empty>
      )}
    </>
  );
}
