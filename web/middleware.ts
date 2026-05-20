import { NextResponse, type NextRequest } from "next/server";

/**
 * /me/* 라우트는 로그인 필수.
 * NextAuth 미설치 상태에서는 placeholder — 모든 /me/* 를 /signin 으로 리다이렉트.
 * W7 에서 NextAuth session 검증으로 교체.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/me")) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/me/:path*"],
};
