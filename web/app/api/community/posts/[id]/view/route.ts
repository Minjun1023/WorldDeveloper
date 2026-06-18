import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

// 조회 1회 등록(공개). 로그인 시 토큰 전달(userId 기준 dedup), 아니면 IP 해시 기준.
// 백엔드가 IP 로 익명 dedup 하므로 클라이언트 IP(X-Forwarded-For)를 반드시 전달한다.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await getSessionToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) headers["X-Forwarded-For"] = xff;
  const realIp = req.headers.get("x-real-ip");
  if (realIp) headers["X-Real-IP"] = realIp;
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/community/posts/${encodeURIComponent(params.id)}/view`,
      { method: "POST", headers, cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    return new NextResponse(null, { status: res.ok ? 204 : res.status });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
