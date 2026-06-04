import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

async function forward(method: "PUT" | "DELETE", jobId: string) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/saved/${encodeURIComponent(jobId)}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return NextResponse.json({ ok: res.ok }, { status: res.status });
  } catch {
    return NextResponse.json({ error: "실패" }, { status: 502 });
  }
}

export async function PUT(_req: Request, ctx: { params: { jobId: string } }) {
  const { jobId } = ctx.params;
  return forward("PUT", jobId);
}
export async function DELETE(_req: Request, ctx: { params: { jobId: string } }) {
  const { jobId } = ctx.params;
  return forward("DELETE", jobId);
}
