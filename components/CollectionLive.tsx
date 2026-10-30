"use client";
import { useEffect, useRef, useState } from "react";

// 브라우저의 새 화면을 즉시 그립니다. 연결 종료·재연결 때 이미 표시한 화면을 지우지 않습니다.
export default function CollectionLive({ jobId, active }: { jobId?: string; active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!jobId || !active) return;
    let disposed = false, painting = false, pending: string | undefined;
    const source = new EventSource(`/api/features/social/stream?jobId=${encodeURIComponent(jobId)}`);
    const paint = async () => {
      if (painting || !pending) return;
      painting = true;
      const data = pending; pending = undefined;
      try {
        const bytes = Uint8Array.from(atob(data), letter => letter.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
        if (!disposed && canvas.current) {
          canvas.current.getContext("2d")?.drawImage(bitmap, 0, 0, 960, 600);
          setVisible(true);
        }
        bitmap.close();
      } catch { /* 손상된 프레임은 건너뛰고 마지막 정상 화면을 유지합니다. */ }
      finally { painting = false; if (!disposed && pending) void paint(); }
    };
    source.addEventListener("frame", event => { pending = (event as MessageEvent).data; void paint(); });
    return () => { disposed = true; source.close(); };
  }, [jobId, active]);
  return <section className="crawl-screen" aria-label="실시간 크롤링 화면" hidden={!visible}>
    <canvas ref={canvas} width={960} height={600} role="img" aria-label="실시간 수집 브라우저" />
  </section>;
}

