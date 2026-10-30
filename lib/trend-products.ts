import { readFileSync } from "node:fs";
import path from "node:path";

const normalize = (s: string) => s.toLowerCase().replace(/[\s_#-]+/g, "");
type Product = { name: string; aliases: string[] };
// 대량 수집 중 같은 사전을 게시물마다 디스크에서 읽지 않도록 모듈 단위로 보관합니다.
const registry = JSON.parse(readFileSync(path.join(process.cwd(), "content/trend-products.json"), "utf8")) as { products: Product[] };

export function productNames(text: string): { products: string[]; candidates: string[] } {
  const compact = normalize(text);
  const matches = registry.products.flatMap((product) => {
    const aliases = product.aliases.filter((alias) => {
      // 영어 단어는 단어 경계를 확인해 ‘cookie’가 다른 단어의 일부로 잡히는 것을 줄입니다.
      if (/^[a-zé ]+$/i.test(alias))
        return new RegExp(`\\b${alias.trim().replace(/\s+/g, "\\s*")}\\b`, "i").test(text);
      return compact.includes(normalize(alias));
    });
    return aliases.length ? [{ name: product.name, aliases: aliases.map(normalize) }] : [];
  });
  // 같은 게시물의 ‘상하이 버터떡’에서 다시 ‘버터떡’을 세지 않습니다.
  const products = matches.filter((m) => !matches.some((other) => other.name !== m.name && m.aliases.every((a) => other.aliases.some((b) => b !== a && b.includes(a))))).map((m) => m.name);
  const candidates = new Set<string>();
  // 사전에 없는 복합 제품명은 본문에서도 찾습니다. 추출 후보일 뿐 검증된 제품명이나 유행이 아닙니다.
  for (const match of text.matchAll(/[가-힣]{2,12}(?:쿠키|케이크|버터떡|초콜릿|타르트|푸딩|베이글|도넛|빵)/g)) {
    const term = match[0];
    if (registry.products.some((p) => p.aliases.some((a) => normalize(a) === normalize(term)))) continue;
    if (/오늘|만든|만드는|먹는|맛있는|맛있던|이런|저런|추천|수제|홈메이드|베이킹|레시피|만들기/.test(term)) continue;
    candidates.add(term);
  }
  return { products: [...new Set(products)], candidates: [...candidates] };
}
