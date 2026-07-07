import type { MetadataRoute } from "next";

// 크롤러 정책 — 공개 콘텐츠(공고·기업·커뮤니티·가이드)는 허용, 개인 영역·API 는 차단.
// sitemap 은 정식 도메인 연결 후 추가 예정(sslip.io 주소로 색인시키지 않기 위해 보류).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/me/", "/bookmarks", "/signin", "/signup", "/verify-email"],
    },
  };
}
