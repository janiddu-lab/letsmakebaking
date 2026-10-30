"use client";
import { useEffect, useRef, type ReactNode } from "react";
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
        return source ? (
          <a key={id} href={source.url} target="_blank" rel="noreferrer">
            {source.title} ↗
          </a>
        ) : (
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
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="닫기">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
