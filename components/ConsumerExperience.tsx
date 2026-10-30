"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLab, api, amount, allergenName } from "./context";
import { Empty, PageHeading } from "./ui";
import { stockAmount } from "@/lib/domain";
import type { Pantry, Recipe } from "@/lib/types";
import { bakeLink, preparationFingerprint, preparationChecks } from "@/lib/consumer-flow";

// 처음 온 사용자도 등록 → 탐색 → 만들기 → 기록 순서를 놓치지 않도록 연결합니다.
export function KitchenJourney() {
  const { boot } = useLab();
  if (!boot) return null;
  const steps = [
    { href: "/kitchen", title: "1. 내 주방 채우기", text: `${boot.user.pantry.length}개 재료 · ${boot.user.equipment.length}개 도구`, done: boot.user.pantry.length > 0 },
    { href: "/discover", title: "2. 만들 메뉴 찾기", text: "가진 재료로 추천받기", done: boot.user.saved.length > 0 },
    { href: "/saved", title: "3. 저장한 메뉴 꺼내기", text: `${boot.user.saved.length}개 저장 · 재료 확인 후 만들기`, done: boot.user.journal.length > 0 },
    { href: "/journal", title: "4. 다음 시도에 남기기", text: `${boot.user.journal.length}번의 베이킹 기록`, done: boot.user.journal.length > 0 },
  ];
  const active = boot.user.sessions.filter(s => s.status === "in-progress").slice(-1)[0];
  return <section className="consumer-journey" aria-label="나의 베이킹 시작하기">
    <div className="section-heading"><h2>오늘은 여기서 시작해요</h2><Link href="/settings">내 기록 백업 ↗</Link></div>
    <div className="journey-grid">{steps.map(s => <Link key={s.href} href={s.href} className="journey-card"><strong>{s.done ? "✓ " : ""}{s.title}</strong><span>{s.text}</span></Link>)}</div>
    {active && <p className="notice">진행 중인 베이킹이 있어요. <Link href={bakeLink(active.recipeId, { versionId: active.versionId, scale: active.scale, run: active.run })}>마지막 단계부터 이어하기 →</Link></p>}
  </section>;
}

export function RecipePreparation({ recipe }: { recipe: Recipe }) {
  const { boot, save, notify } = useLab();
  const [checked, setChecked] = useState<string[]>(() => preparationChecks(boot!.user.settings, recipe));
  const [copying, setCopying] = useState(false);
  const c = boot!.catalog;
  const items = recipe.ingredients.filter(i => !i.optional).map(item => {
    const ing = c.ingredients.find(i => i.id === item.id);
    const stock = stockAmount(boot!.user.pantry as unknown as Pantry[], item, c, recipe.cupMl ?? 240);
    return { ...item, name: ing?.name ?? item.id, stock, missing: Math.max(0, item.quantity - stock.total) };
  });
  const missing = items.filter(i => i.missing > 0 && !i.stock.unknown);
  const tools = recipe.equipmentIds.filter(id => !boot!.user.equipment.some(e => e.equipmentId === id));
  const allergens = [...new Set(recipe.ingredients.flatMap(item => c.ingredients.find(i => i.id === item.id)?.allergens ?? []))];
  const ready = items.filter(i => !i.stock.unknown && i.missing === 0).length;
  const shopping = () => missing.map(i => `□ ${i.name} ${amount(i.missing)} ${i.unit}`).join("\n");
  return <section className="panel preparation space-top">
    <div className="panel-title"><h2>시작 전, 내 주방과 대조하기</h2><Link href="/kitchen">재고 수정 ↗</Link></div>
    <p>필수 재료 {items.length}개 중 {ready}개는 수량까지 확인됐어요. 계량한 재료를 체크하세요.</p>
    <div className="preparation-list">{items.map(i => <label className="check-label" key={i.id}>
      <input type="checkbox" checked={checked.includes(i.id)} onChange={async () => {
        const before = checked, next = checked.includes(i.id) ? checked.filter(id => id !== i.id) : [...checked, i.id];
        setChecked(next);
        if (!await save("settings", { id: `preparation-${recipe.id}-${recipe.yieldCount}`, kind: "preparation", fingerprint: preparationFingerprint(recipe), checks: next })) setChecked(before);
      }} />
      <span><strong>{i.name}</strong> {amount(i.quantity)} {i.unit}<small>{i.stock.unknown ? "보유량 확인 필요" : i.missing ? `${amount(i.missing)} ${i.unit} 추가 준비` : "보유량 충분"}</small></span>
    </label>)}</div>
    <p role="status">계량 확인 {checked.length} / {items.length} · 같은 배합으로 만들기를 시작하면 체크를 이어갑니다.</p>
    {!!allergens.length && <p>재료 사전에 표시된 알레르기 관련 성분: <strong>{allergens.map(allergenName).join(" · ")}</strong>. 실제 사용 제품의 성분표도 확인하세요.</p>}
    {!!tools.length && <p className="notice">확인할 도구: {tools.map(id => c.equipment.find(t => t.id === id)?.name ?? id).join(" · ")} <Link href="/lab">대체 방법 찾기 ↗</Link></p>}
    <div className="row-actions"><button className="button outline" disabled={!missing.length || copying} onClick={async () => {
      setCopying(true);
      try { await navigator.clipboard.writeText(`${recipe.title} 장보기\n${shopping()}`); notify("장보기 목록을 복사했어요."); } catch { notify("복사하지 못했어요. 아래 장보기 목록을 직접 선택해 복사하세요."); } finally { setCopying(false); }
    }}>부족한 재료 목록 복사</button><button className="button outline" onClick={() => save("saved", { recipeId: recipe.id })}>이 레시피 저장</button><button className="button outline" onClick={() => window.print()}>레시피 인쇄</button></div>
    {!!missing.length && <details><summary>장보기 목록 펼치기</summary><pre className="pre-wrap">{shopping()}</pre></details>}
    <p className="small muted">선택 장식은 제외합니다. 보유량 미확인 항목은 구매량을 임의로 계산하지 않습니다.</p>
  </section>;
}

export function PersonalSettings() {
  const { boot, profileId, setProfile, act, refresh, notify } = useLab();
  const [nickname, setNickname] = useState(boot!.profile.nickname);
  const [backup, setBackup] = useState<any>(null);
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(localStorage.getItem("baking-reduce-motion") === "true"), []);
  return <><PageHeading eyebrow="MY WORKSPACE" title="내 주방과 기록 관리" description="이 브라우저에 저장됩니다. 다른 기기에서는 백업 파일로 옮길 수 있어요." />
    <div className="two-column"><section className="panel"><h2>주방 별명</h2><form onSubmit={async e => { e.preventDefault(); if (await act(() => api(`profiles/${profileId}`, { nickname }, "PATCH"), "별명을 바꿨어요.")) await refresh(); }}><label className="field">나를 부를 이름<input value={nickname} maxLength={30} required onChange={e => setNickname(e.target.value)} /></label><button className="button primary">별명 저장</button></form><p className="small muted">별명은 로그인이나 비밀번호 보호 기능이 아닙니다. 공용 컴퓨터에서는 개인 내용을 남기지 마세요.</p></section>
    <section className="panel"><h2>저장된 나의 활동</h2><p>재료 {boot!.user.pantry.length}개 · 즐겨찾기 {boot!.user.saved.length}개 · 완성 기록 {boot!.user.journal.length}개</p><label className="check-label"><input type="checkbox" checked={reduced} onChange={e => { setReduced(e.target.checked); localStorage.setItem("baking-reduce-motion", String(e.target.checked)); document.documentElement.classList.toggle("reduce-motion", e.target.checked); window.dispatchEvent(new Event("baking-motion-change")); }} />3D 자동 회전과 움직임 줄이기</label><p>브라우저 데이터 삭제·시크릿 모드 종료 시 기록이 사라질 수 있어요. 서버 재시작과는 무관하게 보관됩니다.</p></section></div>
    <section className="panel space-top"><h2>사진 포함 백업과 복원</h2><p>주방 재료·가격·즐겨찾기·수정본·완성 기록·사진을 JSON 한 파일에 보관해요. 복원 시 기존 주방은 유지하고 별도의 주방을 추가합니다.</p><button className="button primary" onClick={() => act(async () => {
      const data = await api(`export?profileId=${profileId}`); const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = `나의_베이킹랩_${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify("백업 파일을 내려받았어요.");
    })}>내 기록 백업 내려받기</button><label className="field space-top">백업 JSON 가져오기<input type="file" accept=".json,application/json" onChange={e => { const file = e.target.files?.[0]; if (!file) return; setBackup(null); act(async () => { if (file.size > 20_000_000) throw new Error("20MB 이하 백업을 선택하세요."); const data = JSON.parse(await file.text()); const { validateBackup } = await import("@/lib/browser-kitchen"); validateBackup(data, boot!.catalog); setBackup(data); }); e.target.value = ""; }} /></label>
    {backup && <div className="notice"><h3>복원할 기록을 확인하세요</h3><p>{backup.profile?.nickname ?? "가져온 주방"} · 완성 기록 {backup.data.journal?.length ?? 0}개 · 즐겨찾기 {backup.data.saved?.length ?? 0}개 · 사진 {Object.keys(backup.photos ?? {}).length}개</p><button className="button primary" onClick={() => act(async () => { const profile = await api("browser/import", backup); setBackup(null); setProfile(profile.id); notify("새 주방에 복원했어요."); })}>별도 주방으로 복원</button><button className="button outline" onClick={() => setBackup(null)}>취소</button></div>}
    </section><section className="panel space-top"><h2>이 웹에서 가능한 것</h2><p>개인 주방과 기록은 내 브라우저에서 관리하고, 레시피·팁·계산·실험 도구를 함께 사용할 수 있어요. 트렌드의 새 수집은 운영자가 발급한 접근 코드가 필요합니다.</p><p>AI 채팅과 재료 사진 자동 인식, 방문자 간 공동 실험 집계는 아직 제공하지 않습니다. 개인 실험은 이 기기 기록으로 비교할 수 있어요.</p><Link href="/learn">팁과 재료 사전으로 가기 →</Link></section>
    {!boot!.user.journal.length && <Empty title="첫 기록을 남겨보세요"><Link className="button outline" href="/recipes">만들 레시피 고르기</Link></Empty>}</>;
}

export function ModelPicker() {
  const { boot, save } = useLab();
  return <div className="science-sheet"><h2>홈 화면에 둘 베이킹 오브제</h2><p>마음에 드는 모델을 고르면 이 브라우저의 홈 화면에 적용돼요.</p><div className="article-grid"><button className="button outline" onClick={() => save("settings", { id: "home-model", kind: "model-preference", builtinModel: null })}>판타지 케이크 · 기본 모델</button>{boot!.assets.models.map((m: any) => <button className="button outline" key={m.id} onClick={() => save("settings", { id: "home-model", kind: "model-preference", builtinModel: m.id })}>{m.title}</button>)}</div><p className="notice">개인 GLB 파일 업로드는 공개 웹에서 제공하지 않습니다. 제작자가 넣은 판타지 케이크와 학습 모델을 선택할 수 있어요.</p><Link className="button primary" href="/">홈에서 확인하기 →</Link></div>;
}
