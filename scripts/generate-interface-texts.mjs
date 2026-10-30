import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
// 화면 소스의 공개 문구만 추출합니다. 사용자 파일·입력·환경 변수는 읽지 않습니다.
const texts = new Set();
for (const file of fs.readdirSync("components").filter(f => /\.tsx$/.test(f))) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join("components", file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const walk = node => {
    if (ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = node.text.replace(/\s+/g, " ").trim();
      if (/[가-힣]/.test(text) && text.length <= 2500) texts.add(text);
    }
    ts.forEachChild(node, walk);
  };
  walk(source);
}
fs.writeFileSync("content/interface-texts.json", JSON.stringify([...texts].sort(), null, 2) + "\n");
console.log(`공개 화면 문구 ${texts.size}개 추출`);
