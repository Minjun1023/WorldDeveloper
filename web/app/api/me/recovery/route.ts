import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { job_id, reason, mark_rejected } = (await req.json()) as {
    job_id?: string;
    reason?: string;
    mark_rejected?: boolean;
  };
  if (!job_id) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  // job_id 인코딩 — 경로 조작으로 다른 백엔드 엔드포인트에 도달하는 것 차단
  const res = await fetch(`${BACKEND_URL}/api/v1/applications/${encodeURIComponent(job_id)}/recovery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ reason: reason ?? "", mark_rejected: mark_rejected ?? true }),
    cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
