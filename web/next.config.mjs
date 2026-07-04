/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // typedRoutes 는 동적 href(`/jobs/${id}`)와 충돌 — 동적 라우트 도입으로 비활성
  // Docker 배포용 standalone 출력(.next/standalone + server.js) — web/Dockerfile 이 이를 사용.
  output: "standalone",
  experimental: {
    // isomorphic-dompurify(jsdom 의존)를 서버 번들에서 제외 — 번들하면 /jobs/[id]
    // page data 수집이 실패한다(jsdom 의 동적 require 들이 웹팩과 비호환).
    serverComponentsExternalPackages: ["isomorphic-dompurify", "jsdom"],
  },
};

export default nextConfig;
