import { expect, test } from "@playwright/test";

// 배포 후 스모크 E2E — 전부 읽기 전용(로그인/저장/발송 없음).
// 목적: "페이지가 200"을 넘어 핵심 사용자 여정이 실제로 렌더되는지 검증.
// 데이터 수치(공고 개수 등)는 단언하지 않는다 — ETL 에 따라 변하는 값이라 깨지기 쉬움.

test("홈 — 히어로와 브랜드가 렌더된다", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/DevPass/);
  await expect(page.getByRole("link", { name: /DevPass/ }).first()).toBeVisible();
  // 히어로 카피(핵심 가치 제안)
  await expect(page.getByText("비자부터 확인하세요")).toBeVisible();
});

test("검색 — 공고 카드가 1개 이상 뜨고 정렬 세그먼트가 있다", async ({ page }) => {
  await page.goto("/search");
  // 공고 카드 링크(/jobs/{id})가 최소 1개 — 백엔드→DB 체인이 살아있다는 뜻.
  await expect(page.locator('a[href^="/jobs/"]').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "최신순" })).toBeVisible();
});

test("공고 상세 — 검색 첫 결과를 열면 제목이 렌더된다", async ({ page }) => {
  await page.goto("/search");
  const first = page.locator('a[href^="/jobs/"]').first();
  await first.waitFor({ timeout: 15_000 });
  await first.click();
  await expect(page).toHaveURL(/\/jobs\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("기업 디렉터리 — 목록과 분야 드롭다운이 동작한다", async ({ page }) => {
  await page.goto("/companies");
  await expect(page.locator('a[href^="/companies/"]').first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "분야 필터" }).click();
  // shadcn DropdownMenu(Radix) — 옵션은 role=menuitem
  await expect(page.getByRole("menuitem", { name: "분야 전체" })).toBeVisible();
});

test("커뮤니티 — 카테고리 탭이 렌더된다", async ({ page }) => {
  await page.goto("/community");
  await expect(page.getByRole("link", { name: /전체/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "글쓰기" }).first()).toBeVisible();
});

test("로그인 화면 — 폼이 렌더된다", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("파비콘·robots 등 정적 자원이 응답한다", async ({ request }) => {
  const favicon = await request.get("/favicon.ico");
  expect(favicon.status()).toBe(200);
});
