import assert from "node:assert/strict";
import sharp from "sharp";
import { unzipSync } from "fflate";
// 검증 전용 서버와 별도 DB에서 실행합니다. 실제 사용자의 기록을 지우지 않습니다.
const base = process.env.BAKING_TEST_URL ?? "http://127.0.0.1:3211";
let token = "",
  profile = "local-default",
  passed = 0;
async function request(route, body, method) {
  const response = await fetch(
    `${base}/api/${route}${route.includes("?") ? "&" : "?"}profileId=${profile}`,
    {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        Origin: base,
        "x-csrf-token": token,
      },
      ...(body === undefined
        ? {}
        : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    },
  );
  const payload = await response.json();
  if (payload.meta?.csrfToken) token = payload.meta.csrfToken;
  return { status: response.status, ...payload };
}
function check(condition, message) {
  assert.ok(condition, message);
  passed++;
}
const boot = await request("bootstrap");
check(boot.status === 200, "초기 데이터");
const attack = await fetch(`${base}/api/profiles`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ nickname: "잘못된 요청" }),
});
check(attack.status === 403, "CSRF 차단");
const p = await request("profiles", { nickname: "API 검증 주방" });
profile = p.data.id;
check(!!profile, "프로필 생성");
const invalid = await request("state/pantry", {
  ingredientId: boot.data.catalog.ingredients[0].id,
  quantity: -1,
  unit: "g",
});
check(invalid.status === 422, "음수 수량 거절");
const recipe = boot.data.catalog.recipes.find(
  (r) => r.evidence === "FORMULA_REVIEWED",
);
for (const item of recipe.ingredients.filter((i) => !i.optional)) {
  check(
    (
      await request("state/pantry", {
        ingredientId: item.id,
        quantity: item.quantity * 3,
        unit: item.unit,
      })
    ).status === 201,
    "재고 저장",
  );
  await request("state/prices", {
    ingredientId: item.id,
    packageQuantity: item.unit === "ea" ? 10 : 1000,
    packageUnit: item.unit,
    packagePrice: 2000,
    currency: "KRW",
    isSample: true,
  });
}
for (const id of recipe.equipmentIds)
  await request("state/equipment", { equipmentId: id });
const input = {
  entryMode: "INGREDIENT_FIRST",
  ingredientMode: "STRICT",
  allowedIds: recipe.ingredients.map((i) => i.id),
  mustUseIds: [],
  excludedIds: [],
  pantry: recipe.ingredients.map((i) => ({
    ingredientId: i.id,
    quantity: i.quantity * 3,
    unit: i.unit,
  })),
  equipment: recipe.equipmentIds,
};
const match = await request("matches", input);
check(
  match.data.results.some(
    (r) => r.recipe.id === recipe.id && r.state === "READY",
  ),
  "엄격 추천 실제 연결",
);
const strict = await request("matches", { ...input, allowedIds: [] });
check(strict.data.results.length === 0, "엄격 모드 조건 미완화");
const cost = await request("calculations", {
  kind: "cost",
  recipeId: recipe.id,
  scale: 1,
});
check(
  !cost.data.incomplete && cost.data.total > 0 && cost.data.additional === 0,
  "원가와 보유 재고 계산",
);
const pan = await request("calculations", {
  kind: "pan",
  original: { shape: "round", width: 20 },
  next: { shape: "round", width: 10 },
});
check(pan.data.factor === 0.25, "팬 변환");
const preview = await request("adaptations/preview", {
  recipeId: recipe.id,
  ruleIds: [],
  scale: 0.5,
});
check(!!preview.data.previewId, "수정 미리보기");
const version = await request("recipe-versions", {
  previewId: preview.data.previewId,
  label: "검증용 절반 배합",
});
check(
  version.data.recipe.ingredients[0].quantity ===
    recipe.ingredients[0].quantity / 2,
  "스냅샷 저장",
);
const save1 = await request("saved-recipes", { recipeId: recipe.id });
const save2 = await request("saved-recipes", { recipeId: recipe.id });
check(save1.data.id === save2.data.id, "저장 중복 방지");
const image = await sharp({
  create: { width: 30, height: 30, channels: 3, background: "#dca66b" },
})
  .png()
  .toBuffer();
const form = new FormData();
form.set("file", new Blob([image], { type: "image/png" }), "test.png");
const upload = await request("uploads", form);
check(upload.status === 200, "이미지 검증과 재인코딩");
const log = await request("state/journal", {
  title: "검증용 만들기",
  note: "직접 만든 테스트 자료",
  recipe,
  recipeId: recipe.id,
  photos: [upload.data.id],
});
check(!!log.data.id, "완성 기록");
const consumption = await request("inventory-consumptions/preview", {
  bakeLogId: log.data.id,
});
check(!!consumption.data.previewToken, "차감 미리보기");
const applied = await request("inventory-consumptions/confirm", {
  bakeLogId: log.data.id,
  previewToken: consumption.data.previewToken,
});
const appliedAgain = await request("inventory-consumptions/confirm", {
  bakeLogId: log.data.id,
  previewToken: consumption.data.previewToken,
});
check(
  applied.data.consumed && appliedAgain.data.alreadyConsumed,
  "차감 멱등성",
);
const exported = await fetch(
  `${base}/api/export?profileId=${profile}&format=zip`,
);
const zip = new Uint8Array(await exported.arrayBuffer());
const files = unzipSync(zip);
check(
  !!files["data.json"] && Object.keys(files).some((k) => k.endsWith(".webp")),
  "이미지 포함 ZIP 백업",
);
const second = await request("profiles", { nickname: "백업 복원 검증" });
profile = second.data.id;
const stolen = await request(`state/journal/${log.data.id}`);
check(stolen.status === 404, "다른 프로필 기록 보호");
const archiveForm = new FormData();
archiveForm.set(
  "file",
  new Blob([zip], { type: "application/zip" }),
  "backup.zip",
);
const importPreview = await request("import/archive-preview", archiveForm);
check(importPreview.data.counts.photos === 1, "사진 포함 가져오기 미리보기");
check(
  (
    await request("import/confirm", {
      previewToken: importPreview.data.previewToken,
    })
  ).data.imported,
  "가져오기 확정",
);
const restored = await request("journal");
check(restored.data[0].photos[0] !== upload.data.id, "사진 ID 재매핑");
const restoredImage = await fetch(
  `${base}/api/uploads/${restored.data[0].photos[0]}?profileId=${profile}`,
);
check(
  restoredImage.status === 200 &&
    restoredImage.headers.get("content-type") === "image/webp",
  "복원 사진 접근",
);
const ai = await request("ai/chat", {
  message: "계산할 수 있나요?",
  consent: false,
});
check(
  [422, 503].includes(ai.status),
  "키 또는 전송 동의 없이 외부 AI 호출 금지",
);
const prompt = await request("admin/prompts", {
  name: "검증 프롬프트",
  body: "한국어로 자료를 확인하고 근거가 없으면 질문하는 베이킹 코치입니다.",
});
check(prompt.data.active === false, "새 프롬프트는 비활성 초안");
const contribution = await request("contributions", {
  title: "검증 팁",
  text: "검증 전에는 공개하지 않습니다.",
});
check(contribution.data.status === "REVIEW_PENDING", "기여 검토 대기");
const invalidContent = await request("admin/content", {
  kind: "articles",
  status: "PUBLISHED",
  payload: { id: "invalid", title: "출처 없음", sourceIds: [] },
});
check(invalidContent.status === 422, "출처 없는 공개 거절");
console.log(
  JSON.stringify(
    { passed, base, notice: "별도 검증 DB에만 테스트 자료가 남아 있습니다." },
    null,
    2,
  ),
);
