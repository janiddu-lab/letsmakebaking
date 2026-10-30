"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useLab, api } from "./context";
import { asLanguage, languages, normalizeText, translateCore, type Language } from "@/lib/locale";
import { knownPublicTexts } from "@/lib/public-translation-texts";
const Locale = createContext({ language: "ko" as Language, setLanguage: (_l: Language) => {}, t: (text: string) => text });
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("ko");
  useEffect(() => { try { const saved = asLanguage(localStorage.getItem("baking-language")); document.documentElement.lang = saved; setLanguage(saved); } catch {} }, []);
  useEffect(() => { document.documentElement.lang = language; document.title = language === "en" ? "My Baking Lab | Bake with what you have" : language === "ja" ? "おうちベーキングラボ | 家にあるもので作ろう" : "우리집 베이킹랩 | 가진 것으로 시작하는 베이킹"; }, [language]);
  return <Locale.Provider value={{ language, setLanguage: value => { document.documentElement.lang = value; setLanguage(value); try { localStorage.setItem("baking-language", value); } catch {} }, t: text => translateCore(text, language) }}>{children}</Locale.Provider>;
}
export const useLocale = () => useContext(Locale);
export function LanguageSwitcher() {
  const { language, setLanguage } = useLocale();
  return <label className="language-switcher" data-no-translate="true"><span aria-hidden="true">🌐</span><select aria-label="Language / 언어 / 言語" value={language} onChange={e => setLanguage(asLanguage(e.target.value))}>{Object.entries(languages).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>;
}

const excluded = "script,style,noscript,code,pre,textarea,input,[data-no-translate],.journal-card,.comparison-note,.inventory-row,.profile-select,.chat-message,.toast";
export function PageTranslator() {
  const { language } = useLocale();
  const { boot } = useLab();
  const pathname = usePathname();
  const [status, setStatus] = useState<"ready" | "loading" | "partial">("ready");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!boot || language === "ko") { setStatus("ready"); return; }
    let disposed = false, busy = false, partial = false;
    const known = knownPublicTexts(boot.catalog), records = new Map<Text, { source: string; last: string }>();
    const attributes = new Map<Element, Map<string, { source: string; last: string }>>();
    const attempted = new Set<string>(), cache: Record<string, string> = {};
    const cacheKey = `baking-translations-v1-${language}`;
    try { Object.assign(cache, JSON.parse(localStorage.getItem(cacheKey) ?? "{}")); } catch {}
    let timer: ReturnType<typeof setTimeout>;
    const translated = (source: string) => { const core = translateCore(source, language); return core !== source ? core : cache[source]; };
    const scan = () => {
      const pending = new Set<string>();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let next: Node | null;
      while ((next = walker.nextNode())) {
        const node = next as Text;
        if (!node.parentElement || node.parentElement.closest(excluded)) continue;
        let record = records.get(node);
        if (!record || node.data !== record.last) record = { source: node.data, last: node.data };
        const source = normalizeText(record.source);
        if (!/[가-힣]/.test(source)) continue;
        const target = translated(source);
        if (target) { record.last = `${record.source.match(/^\s*/)?.[0] ?? ""}${target}${record.source.match(/\s*$/)?.[0] ?? ""}`; if (node.data !== record.last) node.data = record.last; }
        else if (known.has(source) && !attempted.has(source)) pending.add(source);
        records.set(node, record);
      }
      for (const node of Array.from(document.querySelectorAll("[placeholder],[aria-label],[title]"))) {
        if (node.closest("[data-no-translate],.journal-card,.chat-message,.inventory-row,.profile-select")) continue;
        const map = attributes.get(node) ?? new Map();
        for (const name of ["placeholder", "aria-label", "title"]) {
          const value = node.getAttribute(name); if (value === null) continue;
          let record = map.get(name); if (!record || value !== record.last) record = { source: value, last: value };
          const source = normalizeText(record.source), target = translated(source);
          if (target) { record.last = target; if (value !== target) node.setAttribute(name, target); }
          else if (known.has(source) && !attempted.has(source) && /[가-힣]/.test(source)) pending.add(source);
          map.set(name, record);
        }
        attributes.set(node, map);
      }
      return [...pending];
    };
    const process = async () => {
      if (disposed || busy) return;
      busy = true;
      try {
        let pending = scan();
        if (pending.length && !boot.health.ai) { setStatus("partial"); return; }
        while (pending.length && !disposed) {
          const batch: string[] = []; let size = 0;
          for (const text of pending) { if (batch.length === 25 || size + text.length > 6000) break; batch.push(text); size += text.length; }
          if (!batch.length) break;
          setStatus("loading"); batch.forEach(t => attempted.add(t));
          try {
            const response = await api("translations", { language, texts: batch });
            if (disposed) return;
            Object.assign(cache, response.translations);
            try { localStorage.setItem(cacheKey, JSON.stringify(Object.fromEntries(Object.entries(cache).slice(-1500)))); } catch {}
            if (response.missing?.length) partial = true;
          } catch { if (!disposed) { setStatus("partial"); scan(); } return; }
          pending = scan();
        }
        if (!disposed) setStatus(partial ? "partial" : "ready");
      } finally { busy = false; }
    };
    const observer = new MutationObserver(() => { if (!busy && !disposed) { clearTimeout(timer); timer = setTimeout(process, 200); } });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
    process();
    return () => {
      disposed = true; clearTimeout(timer); observer.disconnect();
      for (const [node, record] of records) if (node.isConnected && node.data === record.last) node.data = record.source;
      for (const [node, map] of attributes) if (node.isConnected) for (const [name, record] of map) if (node.getAttribute(name) === record.last) node.setAttribute(name, record.source);
    };
  }, [language, pathname, !!boot, retry]);
  if (language === "ko") return null;
  return <div className="translation-status" data-no-translate="true" role="status">{language === "en" ? status === "loading" ? "Translating public page content…" : status === "partial" ? "Some content is still in Korean." : "English · AI translations may contain errors. Private notes stay in their original language." : status === "loading" ? "公開コンテンツを翻訳中…" : status === "partial" ? "一部の内容は韓国語のままです。" : "日本語 · AI翻訳には誤りが含まれる場合があります。個人の記録は原文を保持します。"}{status === "partial" && <button className="text-button" onClick={() => setRetry(n => n + 1)}>{language === "en" ? "Retry translation" : "再翻訳"}</button>}</div>;
}
