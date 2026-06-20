/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // typedRoutes 는 동적 href(`/jobs/${id}`)와 충돌 — 동적 라우트 도입으로 비활성
  // Docker 배포용 standalone 출력(.next/standalone + server.js) — web/Dockerfile 이 이를 사용.
  output: "standalone",
};

export default nextConfig;
