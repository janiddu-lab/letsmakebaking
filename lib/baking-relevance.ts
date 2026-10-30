import { productNames } from "./trend-products";

// 제과·제빵 웹에 섞이기 쉬운 동음이의어·게임·청소·일반 요리·성인 홍보를 우선 제외합니다.
const offTopic = /쿠키런|쿠킹덤|쿠키클리커|cookie\s*(?:run|clicker)|\bcrk\b|섹트|섹블|야동|성인방|조건만남|후방주의|onlyfans|nsfw|청소|세탁|기름때|cleaning|soda\s*ash|chemical\s*complex|stained\s*pillow|baking\s*soda\s*(?:hack|clean|bath)|roast\s*(?:chicken|beef)|baked\s*(?:chicken|potato|salmon|beans)|mac\s*(?:and|&)\s*cheese|치킨|삼겹살|스테이크|구운감자|쿠키삭제|쿠키동의|세션쿠키|브라우저쿠키|cookie\s*(?:policy|consent|settings)|tracking\s*cookies?|browser\s*cookies?/i;
const bakingContext = /제과|제빵|홈베이킹|베이킹|베이커리|디저트|구움과자|빵집|파티시에|쿠키|케이크|타르트|휘낭시에|마들렌|도넛|초콜릿|크루아상|소금빵|버터떡|두쫀쿠|\b(?:baking|bakery|patisserie|pâtisserie|pastry|pastries|dessert|cookies?|cakes?|bread|brownies?|sourdough|bagels?|croissants?|muffins?|icing)\b/i;

export function isBakingRelated(text: string): boolean {
  if (offTopic.test(text)) return false;
  const names = productNames(text);
  return !!(names.products.length || names.candidates.length || bakingContext.test(text));
}

const allowedTags = new Set([
  "baking", "homebaking", "baker", "bakery", "breadmaking", "breadbaking", "sourdough", "sourdoughbread", "sourdoughstarter", "bakingbread", "pastry", "pastries", "patisserie", "pâtisserie", "dessert", "desserts", "dessertrecipe", "cookiedough", "breadrecipe", "bakingrecipe", "bakingrecipes", "bakingtips", "cookierecipe", "cookierecipes", "cakerecipe", "cakebaking", "homebaker", "brownies", "chocolatechipcookies", "thickcookies", "cookies", "cookie", "coconutcookies", "glutenfreebaking", "veganbaking", "icing", "royalicing", "cakedecorating", "choux", "viennoiserie", "chocolatier", "focaccia", "ciabatta", "financier", "madeleine", "canele", "croissant", "croffle", "crookie", "bagel", "cheesecake", "cinnamonroll", "tiramisu", "poundcake", "meringue", "macaron",
]);
const koreanTag = /^(?:홈베이킹|베이킹|제과|제빵|빵스타그램|빵순이|빵돌이|빵집|베이커리|구움과자|디저트|초보베이킹|노오븐베이킹|에어프라이어베이킹|에어프라이어디저트|쿠키|케이크|타르트|도넛|베이글|스콘|마들렌|휘낭시에|피낭시에|크루아상|크로플|브라우니|소금빵|버터떡|두쫀쿠|파운드케이크|치즈케이크|바스크치즈케이크|바치케|사워도우|치아바타|포카치아|아이싱|머랭|발효빵|빵만들기|초콜릿)(?:레시피|만들기|굽기|연습|기록|수업|클래스|도전|스타그램|러버|맛집)?$/;

export function bakingHashtags(text: string): string[] {
  if (!isBakingRelated(text)) return [];
  const tags = new Set<string>();
  for (const match of text.toLowerCase().matchAll(/#([\p{L}\p{N}_]{2,40})/gu)) {
    const tag = match[1].replace(/_/g, "");
    if (offTopic.test(tag)) continue;
    const names = productNames(tag).products;
    const exactProduct = names.some((name) => name.replace(/\s/g, "") === tag);
    // 일반 food·일상·지역·취향 태그는 글 내용이 베이킹이어도 순위에 포함하지 않습니다.
    if (allowedTags.has(tag) || koreanTag.test(tag) || exactProduct) tags.add(tag);
  }
  return [...tags];
}
