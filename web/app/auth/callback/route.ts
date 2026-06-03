import { NextResponse } from "next/server";

import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";

// Spring OAuth 성공 핸들러가 ${APP_BASE_URL}/auth/callback?code=...[&onboarding=1] 로 리다이렉트한다.
// 여기서 일회용 code 를 Spring /exchange 로 교환해 세션 쿠키(JWT)를 심고,
// 신규 소셜 가입자(onboarding=1)는 프로필 온보딩으로, 기존 사용자는 홈으로 보낸다.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const code = params.get("code");
  const dest = params.get("onboarding") === "1" ? "/onboarding/profile" : "/";
  if (!code) {
    return NextResponse.redirect(new URL("/signin?error=oauth", APP_BASE_URL));
  }

  const res = await fetch(`${BACKEND_URL}/api/v1/auth/exchange`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Internal-Auth": process.env.INTERNAL_AUTH_SECRET ?? "",
    },
    body: JSON.stringify({ code }),
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.redirect(new URL("/signin?error=oauth", APP_BASE_URL));
  }

  const data = (await res.json()) as { token: string };
  const out = NextResponse.redirect(new URL(dest, APP_BASE_URL));
  out.cookies.set(SESSION_COOKIE, data.token, sessionCookieOptions());
  return out;
}
