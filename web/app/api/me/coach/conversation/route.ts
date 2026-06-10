import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

function jobIdOf(req: Request): string {
  return new URL(req.url).searchParams.get("jobId") ?? "";
}

export async function GET(req: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const jobId = jobIdOf(req);
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/me/coach/conversation?jobId=${encodeURIComponent(jobId)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (res.status === 204) return new NextResponse(null, { status: 204 });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "불러올 수 없어요." }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const jobId = jobIdOf(req);
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/me/coach/conversation?jobId=${encodeURIComponent(jobId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    return NextResponse.json({ ok: res.ok }, { status: res.status });
  } catch {
    return NextResponse.json({ error: "실패" }, { status: 502 });
  }
}
