import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

// 글 목록 (공개) — 클라이언트(역노출 섹션 등)에서 회사/국가/공고별 글을 가져온다.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams();
  for (const k of ["category", "company", "country", "jobId", "sort", "page"]) {
    const v = searchParams.get(k);
    if (v) qs.set(k, v);
  }
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/community/posts?${qs.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json().catch(() => ({ items: [], has_more: false }));
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ items: [], has_more: false }, { status: 200 });
  }
}

// 글 작성 (인증). 백엔드가 PostDetail 반환.
export async function POST(req: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/community/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: await req.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "서버에 연결할 수 없어요." }, { status: 502 });
  }
}
