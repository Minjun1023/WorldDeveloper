import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/session";
import { getSessionToken } from "@/lib/session-server";

// 회원탈퇴: 세션 토큰으로 백엔드 호출 → 성공 시 세션 쿠키 제거. 본문(비번/확인)은 그대로 전달.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await fetch(`${BACKEND_URL}/api/v1/me/account/withdraw`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: await req.text(),
    cache: "no-store",
  });
  if (res.status === 204) {
    const out = NextResponse.json({ ok: true }, { status: 200 });
    out.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return out;
  }
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
