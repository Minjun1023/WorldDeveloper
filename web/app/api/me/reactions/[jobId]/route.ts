import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function PUT(req: Request, ctx: { params: { jobId: string } }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { jobId } = ctx.params;
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/reactions/${encodeURIComponent(jobId)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: await req.text(),
      cache: "no-store",
    });
    return NextResponse.json({ ok: res.ok }, { status: res.status });
  } catch {
    return NextResponse.json({ error: "실패" }, { status: 502 });
  }
}

export async function DELETE(_req: Request, ctx: { params: { jobId: string } }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { jobId } = ctx.params;
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/reactions/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return NextResponse.json({ ok: res.ok }, { status: res.status });
  } catch {
    return NextResponse.json({ error: "실패" }, { status: 502 });
  }
}
