import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

// 비밀번호 변경: 세션 토큰으로 백엔드 호출. 본문(현재/새 비밀번호)은 그대로 전달.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await fetch(`${BACKEND_URL}/api/v1/me/account/password`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: await req.text(),
    cache: "no-store",
  });
  if (res.status === 204) return NextResponse.json({ ok: true }, { status: 200 });
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
