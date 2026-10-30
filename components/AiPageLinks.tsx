"use client";
import Link from "next/link";
import type { SiteAction } from "@/lib/site-navigation";
import { useLocale } from "./Locale";
export default function AiPageLinks({ actions, onNavigate }: { actions: SiteAction[]; onNavigate: () => void }) {
  const { t, language } = useLocale();
  if (!actions.length) return null;
  return <section className="ai-page-links" aria-label={t("관련 페이지로 이동하기")} data-no-translate="true"><strong>{t("사이트에서 바로 해결하기")}</strong>{actions.map(action => <Link key={action.id} href={action.href} onClick={onNavigate}><span>{t(action.title)} ↗</span>{language === "ko" && <small>{action.description}</small>}</Link>)}</section>;
}
