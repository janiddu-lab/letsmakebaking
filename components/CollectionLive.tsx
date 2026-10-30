"use client";
import { useEffect, useState } from "react";

// 수집 브라우저의 연속 화면만 표시합니다. 설명·로그·저장 장면·재생 버튼은 두지 않습니다.
export default function CollectionLive({ jobId, active }: { jobId?: string; active: boolean }) {
  const [ready, setReady] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => { setReady(false); setRetry(0); }, [jobId]);
  useEffect(() => {
    if (!active || ready) return;
    const timer = setTimeout(() => setRetry(value => value + 1), 15000);
    return () => clearTimeout(timer);
  }, [active, ready, retry]);
  if (!jobId || (!active && !ready)) return null;
  return <section className="crawl-screen" aria-label="실시간 크롤링 화면">
    <img key={`${jobId}-${retry}`} src={`/api/features/social/stream?jobId=${encodeURIComponent(jobId)}&connection=${retry}`} alt="실시간 수집 브라우저" onLoad={() => setReady(true)} onError={() => setReady(false)} />
  </section>;
}
