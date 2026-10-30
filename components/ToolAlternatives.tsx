"use client";
import Link from "next/link";
import { useLab } from "./context";
import { toolAlternatives } from "@/lib/tool-alternatives";
import type { Equipment } from "@/lib/types";
export default function ToolAlternatives({ tool }: { tool: Equipment }) {
  const { boot } = useLab();
  const options = toolAlternatives(tool.id, boot!.catalog);
  return <section className="tool-alternatives" aria-label={`${tool.name} 대체 방법`}>
    <h2>{tool.name} 없을 때, 이렇게 해요</h2><p>집에 있는 물건과 만들려는 모양을 보고 방법을 고르세요.</p>
    {options.length ? <div className="tool-swap-grid">{options.map(option => <article className="tool-swap-card" key={option.id}><div className="tool-swap-arrow"><span>{tool.name}</span><b aria-label="대신">→</b><strong>{option.name}</strong></div><p><b>이럴 때 가능해요</b><br />{option.when}</p><h3>이렇게 사용하세요</h3><ol>{option.steps.map(step => <li key={step}>{step}</li>)}</ol><p className="notice"><b>이건 달라요·주의해요</b><br />{option.limit}</p>{option.link && <Link className="button outline" href={option.link}>{option.link.includes("template") ? "모양 도안 열기 →" : "재료별 단위 환산 →"}</Link>}{option.source && <a className="small" href={option.source} target="_blank" rel="noreferrer">컵으로 모양 내기 참고 ↗</a>}</article>)}</div> : <div className="notice"><strong>이 도구를 대신할 방법은 아직 검토해 등록하지 않았어요.</strong><p>재질·내열 조건을 확인하지 않은 물건을 같은 기능으로 안내하지 않습니다. 특히 가열 기기와 뜨거운 용기는 제품 표시를 확인하세요.</p><Link href="/recipes">다른 도구로 만드는 레시피 살펴보기 →</Link></div>}
  </section>;
}
