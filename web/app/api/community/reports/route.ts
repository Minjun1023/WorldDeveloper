import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/community/reports`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: await req.text(),
      cache: "no-store",
    });
    return NextResponse.json({ ok: res.ok }, { status: res.status });
  } catch {
    return NextResponse.json({ error: "실패" }, { status: 502 });
  }
}
