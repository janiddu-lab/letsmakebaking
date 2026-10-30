import type { Catalog } from "./types";
import interfaceTexts from "../content/interface-texts.json";
import { coreTranslations, normalizeText } from "./locale";
export function knownPublicTexts(c: Catalog): Set<string> {
  const result = new Set([...interfaceTexts, ...Object.keys(coreTranslations)].map(normalizeText));
  const walk = (value: unknown) => {
    if (typeof value === "string") { if (/[가-힣]/.test(value) && value.length <= 2500) result.add(normalizeText(value)); }
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(c); return result;
}
export function filterPublicTranslationTexts(texts: string[], known: Set<string>) {
  return [...new Set(texts.map(normalizeText))].filter(text => known.has(text));
}
