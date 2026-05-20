/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // typedRoutes 는 동적 href(`/jobs/${id}`)와 충돌 — 동적 라우트 도입으로 비활성
};

export default nextConfig;
