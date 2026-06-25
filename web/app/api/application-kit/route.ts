import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

// 프론트 → Next route → Spring 백엔드 프록시. 세션 쿠키를 Bearer 로 변환해 전달한다.
// 백엔드는 전역 Jackson SNAKE_CASE 라 요청/응답 모두 snake_case (예: job_id, skill_gap, fit_summary).
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/application-kit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: await req.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(70_000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "지원 키트 생성 실패" }, { status: 502 });
  }
}
