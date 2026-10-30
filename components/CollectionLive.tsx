"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "./context";
import type { CollectionLive as Live, LiveFrame } from "@/lib/collection-live";
export default function CollectionLive({ jobId, active, demo, setDemo }: { jobId?: string; active: boolean; demo: boolean; setDemo: (v: boolean) => void }) {
  const [open, setOpen] = useState(true), [live, setLive] = useState<Live | null>(null), [error, setError] = useState("");
  const [frames, setFrames] = useState<LiveFrame[]>([]), [index, setIndex] = useState(0), [replay, setReplay] = useState(false), [speed, setSpeed] = useState(500);
  const revision = useRef(-1);
  useEffect(() => { setLive(null); setFrames([]); setReplay(false); revision.current = -1; }, [jobId]);
  useEffect(() => {
    if (!open || !jobId) return;
    let disposed = false, timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let finished = false;
      try {
        const result = await api(`features/social/live?jobId=${encodeURIComponent(jobId)}&after=${revision.current}`);
        if (disposed) return;
        setError("");
        if (!result.unchanged) { setLive(result.live); revision.current = result.live?.revision ?? -1; }
        finished = result.live?.state === "finished" || result.state === "finished" || (!active && result.live === null);
      } catch { if (!disposed) setError("수집 화면 연결을 잠시 놓쳤어요. 수집 자체는 계속 진행될 수 있어요."); }
      if (!disposed && (!finished || active)) timer = setTimeout(poll, 1800);
    };
    poll(); return () => { disposed = true; clearTimeout(timer); };
  }, [jobId, open, active]);
  useEffect(() => {
    if (!replay || !frames.length) return;
    const timer = setTimeout(() => { if (index + 1 < frames.length) setIndex(index + 1); else setReplay(false); }, speed);
    return () => clearTimeout(timer);
  }, [replay, index, frames.length, speed]);
  const frame = frames.length && (replay || index > 0) ? frames[index] : live?.frame;
  async function play() {
    if (!jobId) return;
    try {
      const result = await api(`features/social/live?jobId=${encodeURIComponent(jobId)}&frames=1`);
      const shots = result.live?.frames ?? [];
      if (!shots.length) { setError("아직 실제 브라우저 캡처가 없어요. 시연 모드로 Instagram 수집을 실행해 주세요."); return; }
      setFrames(shots); setIndex(0); setReplay(true);
    } catch { setError("저장된 시연 장면을 불러오지 못했어요."); }
  }
  return <section className="collection-live" aria-label="실제 크롤링 화면">
    <div className="collection-live-heading"><div><span className={`live-label ${frames.length ? "replay" : ""}`}>{frames.length ? replay ? "실제 장면 다시보기" : "다시보기 마지막 장면" : active ? "수집 중" : "수집 화면"}</span><h2>크롤링을 눈앞에서 👀</h2></div><button className="button outline" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "화면 접기" : "수집 화면 펼치기"}</button></div>
    <label className="check-label"><input type="checkbox" checked={demo} disabled={active} onChange={e => setDemo(e.target.checked)} />시연 모드 · 실제 게시물도 브라우저로 열기</label>
    <p className="small">시연 모드는 평소보다 느릴 수 있어요. 아래는 실제 공개 페이지 캡처이며, 다시보기는 수집 때 찍힌 장면을 빠르게 넘깁니다.</p>
    {open && <><div className="crawl-browser"><div className="crawl-address"><span aria-hidden="true">● ● ●</span><code>{frame?.url ?? "수집을 시작하면 실제 페이지 주소가 나타나요"}</code><b>{frames.length ? "REPLAY" : "실제 캡처"}</b></div>
      {frame ? <img className="crawl-frame" src={frame.image} alt="실제 수집 브라우저가 연 Instagram 공개 페이지" /> : <div className="crawl-await"><span>🌐</span><h3>페이지가 열리는 모습을 여기에 보여드려요</h3><p>위에서 수집을 시작하세요. API·HTML로만 조회 중이면 브라우저 화면이 없을 수 있어요.</p></div>}
      <div className="crawl-frame-caption">{frame ? `실제 캡처 시각 ${new Date(frame.capturedAt).toLocaleTimeString("ko-KR")}` : "가상의 사이트 화면이나 성공 장면을 만들어 넣지 않아요."}{replay && ` · ${index + 1}/${frames.length} 장면`}</div>
    </div><div className="crawl-playback"><button className="button primary" disabled={!jobId || !live?.frameCount} onClick={play}>파바박 다시보기 ↻</button><label>장면 전환 속도<select aria-label="다시보기 장면 전환 속도" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={1000}>1초</option><option value={500}>0.5초</option><option value={250}>0.25초 · 빠르게</option></select></label>{frames.length > 0 && <button className="text-button" onClick={() => { setReplay(false); setFrames([]); setIndex(0); }}>현재 수집 화면으로</button>}</div>
      {error && <p className="notice" role="status">{error}</p>}
      <div className="crawl-events" aria-label="실제 수집 단계">{live?.events.slice(-8).reverse().map((event, i) => <article key={`${event.at}-${i}`}><time>{new Date(event.at).toLocaleTimeString("ko-KR")}</time><div><strong>{event.query && `#${event.query} · `}{event.message}</strong>{event.caption && <p>“{event.caption}”</p>}{event.publishedAt && <small>{new Date(event.publishedAt).toLocaleDateString("ko-KR")} · {event.included ? "✓ 주간 집계 포함" : "↪ 날짜·관련성 조건으로 집계 제외"}</small>}</div></article>) ?? <p className="small">아직 이 실행의 장면이 없어요. 서버를 재시작하면 이전 시연 장면은 사라집니다.</p>}</div>
    </>}
  </section>;
}
