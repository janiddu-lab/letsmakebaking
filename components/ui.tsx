"use client";
import { useEffect, useRef, useState, useId, type ReactNode } from "react";
import Link from "next/link";
import { Heart, ArrowUpRight, Clock3 } from "lucide-react";
import { useLab, categories } from "./context";
import type { Recipe } from "@/lib/types";
export function Tag({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span>✳</span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
export function RecipeCard({
  recipe,
  detail,
}: {
  recipe: Recipe;
  detail?: ReactNode;
}) {
  const { boot, save, del } = useLab();
  const saved = boot?.user.saved.find((x) => x.recipeId === recipe.id);
  return (
    <article className={`recipe-card theme-${recipe.category}`}>
      <Link className="recipe-art" href={`/recipes/${recipe.id}`}>
        <img
          src={`/assets/illustrations/${recipe.category}.svg`}
          alt={`${recipe.title}의 설명용 삽화`}
        />
        <span className="art-label">{categories[recipe.category]}</span>
      </Link>
      <button
        className={`save-button ${saved ? "active" : ""}`}
        aria-label={saved ? "레시피 저장 해제" : "레시피 저장"}
        onClick={() =>
          saved
            ? del("saved", saved.id)
            : save("saved", { recipeId: recipe.id })
        }
      >
        <Heart size={18} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="recipe-copy">
        <div className="recipe-meta">
          <span>
            <Clock3 size={13} />
            {recipe.totalMin}분
          </span>
          <span>난이도 {["", "쉬움", "보통", "도전"][recipe.difficulty]}</span>
        </div>
        <Link href={`/recipes/${recipe.id}`}>
          <h3>
            {recipe.title}
            <ArrowUpRight size={17} />
          </h3>
        </Link>
        <p>{recipe.description}</p>
        <div className="card-tags">
          <Tag tone={recipe.evidence === "FORMULA_REVIEWED" ? "green" : ""}>
            {recipe.evidence === "FORMULA_REVIEWED"
              ? "출처 배합 대조"
              : "응용 배합 · 미검증"}
          </Tag>
          {recipe.appliance === "none" && <Tag>오븐 없이</Tag>}
        </div>
        {detail && <div className="match-detail">{detail}</div>}
      </div>
    </article>
  );
}
export function SourceList({ ids }: { ids: string[] }) {
  const { boot } = useLab();
  return (
    <div className="source-list">
      <h4>참고한 자료</h4>
      <p className="muted small">
        설명과 삽화는 직접 작성했어요. 실제 제조 검증과는 구분해 주세요.
      </p>
      {ids.map((id) => {
        const source = boot?.catalog.sources.find((s) => s.id === id);
        return source && /^https?:\/\//.test(source.url) ? (
          <a key={id} href={source.url} target="_blank" rel="noreferrer">
            {source.title} ↗
          </a>
        ) : source ? <p key={id}>{source.title} · 자체 제작 자료</p> : (
          <span key={id}>근거 자료 확인 필요</span>
        );
      })}
    </div>
  );
}
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={headingId}>{title}</h2>
        <button onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}

// 기본 confirm/prompt 대신 화면 안에서 확인·취소와 키보드 입력을 제공합니다.
export function useInputDialog() {
  const [request, setRequest] = useState<{ message: string; input: boolean } | null>(null);
  const [value, setValue] = useState("");
  const resolve = useRef<((result: string | null) => void) | null>(null);
  const finish = (result: string | null) => { resolve.current?.(result); resolve.current = null; setRequest(null); };
  useEffect(() => () => { resolve.current?.(null); }, []);
  const ask = (message: string, input: boolean, initial = "") => new Promise<string | null>(done => { resolve.current?.(null); resolve.current = done; setValue(initial); setRequest({ message, input }); });
  return {
    confirm: async (message: string) => (await ask(message, false)) !== null,
    prompt: (message: string, initial = "") => ask(message, true, initial),
    dialog: <Dialog open={!!request} title={request?.input ? "내용 수정" : "변경 전 확인"} onClose={() => finish(null)}>
      <form onSubmit={e => { e.preventDefault(); finish(request?.input ? value : "yes"); }}>
        {request?.input ? <label className="field">{request.message}<input autoFocus value={value} onChange={e => setValue(e.target.value)} /></label> : <p className="pre-wrap">{request?.message}</p>}
        <div className="row-actions"><button type="button" className="button outline" onClick={() => finish(null)}>취소</button><button className="button primary" type="submit">확인</button></div>
      </form>
    </Dialog>,
  };
}
