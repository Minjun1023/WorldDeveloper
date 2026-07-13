import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

// 오늘 잔여 코치 크레딧 조회 프록시 — 코치 컴포저의 "오늘 남은 상담 N회" 표시용.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/coach/credits`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "불러올 수 없어요." }, { status: 502 });
  }
}
