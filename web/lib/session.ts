import { jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7일(초)

export interface Session {
  userId: string;
}

function key(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "");
}

/** Spring 이 발급한 세션 JWT 를 검증. 유효하면 Session, 아니면 null. */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (!payload.sub) return null;
    return { userId: String(payload.sub) };
  } catch {
    return null;
  }
}

/** NextResponse.cookies.set 에 넘길 옵션. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
  };
}
