"use client";
import { useState } from "react";
import Link from "next/link";
import { useLab } from "./context";
import { savedCup, validateCup } from "@/lib/consumer-flow";

export default function CupWorkshop() {
  const { boot, profileId, save, del, notify } = useLab();
  const prior = savedCup(boot!.user.settings);
  const [name, setName] = useState(prior?.name ?? "내 머그컵");
  const [ml, setMl] = useState(prior ? String(prior.ml) : "");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [forget, setForget] = useState(false);
  return <section className="practical-guide space-top" aria-label="내 컵 계량 도구 등록">
    <h2>계량컵이 없어도, 내 컵의 기준선을 만들어요</h2>
    <ol>
      <li>용량이 표시된 계량 용기가 있으면 물의 ml를 확인합니다. 없다면 표시 용량을 아는 작은 음료 팩이나 용기를 기준으로 쓸 수 있어요.</li>
      <li>확인한 양만큼의 물을 내 컵에 옮깁니다. 넘치면 더 작은 기준 용량으로 다시 시도하세요.</li>
      <li>그 물 높이를 컵 바깥쪽에 표시합니다. 컵 가득이 아니라 <strong>내가 표시한 선까지</strong>가 한 컵이에요.</li>
      <li>확인한 ml와 컵 이름을 저장합니다. 이후 재료 등록과 단위 계산기에 이 용량을 가져옵니다.</li>
    </ol>
    <p className="notice">용량을 모르는 컵은 종이컵·머그라는 이름만으로 환산하지 않습니다. 포장 표시를 기준으로 만든 선은 가정용 참고값입니다. 가루를 눌러 담는 정도까지 표준화하지 못하므로 소량 팽창제 등 정밀한 계량이 필요한 재료에는 저울을 사용하세요.</p>
    <form onSubmit={async e => {
      e.preventDefault(); setError("");
      try {
        const value = validateCup(name, Number(ml), confirmed); setBusy(true);
        if (await save("settings", { id: `cup-${profileId}`, ...value })) { setConfirmed(false); notify("내 컵을 저장했어요. 계산기와 재료 등록에 적용됩니다."); }
      } catch (e) { setError(e instanceof Error ? e.message : "용량을 확인하세요."); }
      finally { setBusy(false); }
    }}>
      <div className="field-grid"><label className="field">컵 이름<input maxLength={40} value={name} onChange={e => setName(e.target.value)} required /></label><label className="field">표시선까지 확인한 용량 (ml)<input type="number" min="10" max="2000" step="any" value={ml} onChange={e => { setMl(e.target.value); setConfirmed(false); }} placeholder="직접 확인한 값" required /></label></div>
      <label className="check-label"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />실제 용량을 확인하고 컵에 같은 기준선을 표시했어요.</label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="button primary space-top" disabled={busy || !confirmed}>{busy ? "저장 중…" : "내 컵 저장"}</button>
    </form>
    {prior && <p className="notice" role="status">저장된 컵: <strong>{prior.name} · {prior.ml}ml</strong><br /><Link href={`/calculator?tab=unit&ingredient=water&from=ml&to=cup&amount=${prior.ml}`}>내 컵 한 컵을 계산기에서 확인하기 →</Link></p>}
    {prior && <button className="text-button" onClick={() => setForget(true)}>등록한 컵 삭제</button>}
    {forget && prior && <div className="notice"><p>내 컵 등록을 삭제할까요? 이미 재고에 기록한 컵 용량은 각 재료 기록에서 수정할 수 있어요.</p><button className="button outline" onClick={() => setForget(false)}>등록 유지</button><button className="button outline" onClick={async () => { const record = boot!.user.settings.find(s => s.kind === "cup-profile"); if (record) await del("settings", record.id); setForget(false); setMl(""); setConfirmed(false); }}>컵 등록 삭제 확인</button></div>}
  </section>;
}
