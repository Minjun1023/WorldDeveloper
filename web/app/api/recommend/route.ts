import { NextResponse } from "next/server";

// 프론트 → Next route → Spring 백엔드 프록시 (CORS 회피, BACKEND_URL 은 서버 전용)
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const body = await req.text();
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/recommend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
