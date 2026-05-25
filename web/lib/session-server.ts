import { cookies } from "next/headers";

import { SESSION_COOKIE, verifySessionToken, type Session } from "@/lib/session";

/** 쿠키의 원본 JWT (백엔드로 Bearer 전달용). */
export async function getSessionToken(): Promise<string | null> {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}

/** 검증된 세션 (서버 컴포넌트에서 로그인 상태 확인용). */
export async function getSession(): Promise<Session | null> {
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
}
