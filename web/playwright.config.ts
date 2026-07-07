import { defineConfig, devices } from "@playwright/test";

// 배포 후 프로덕션 스모크 E2E — 읽기 전용 시나리오만(e2e/ 참고).
// 로컬 실행:  E2E_BASE_URL=http://localhost:3000 npm run e2e
// CI(deploy.yml)가 배포 직후 프로덕션 URL 로 실행해 회귀를 감지한다.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 1, // 배포 직후 캐시 웜업 등 일시 흔들림 1회 재시도
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://152.67.215.221.sslip.io",
    ignoreHTTPSErrors: true, // sslip.io 임시 도메인 — 정식 도메인 전환 후 제거 가능
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
