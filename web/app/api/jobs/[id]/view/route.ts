import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

// 공고 조회 1건 기록(분석). 익명키 = sha256(ip+ua) 를 서버에서 계산해 백엔드로 전달.
// 로그인 시 세션 토큰을 함께 보내 user_id 로 dedup. 실패해도 페이지엔 영향 없음(fire-and-forget).
export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ua = req.headers.get("user-agent") ?? "";
  const anonKey = crypto.createHash("sha256").update(`${ip}|${ua}`).digest("hex");
  const token = await getSessionToken();
  try {
    await fetch(`${BACKEND_URL}/api/v1/analytics/view/${encodeURIComponent(params.id)}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ anon_key: anonKey }),
      cache: "no-store",
    });
  } catch {
    // 무시 — 분석 기록 실패가 페이지 동작에 영향 없도록
  }
  return new NextResponse(null, { status: 204 });
}
