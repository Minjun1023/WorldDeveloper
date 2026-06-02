import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await fetch(`${BACKEND_URL}/api/v1/recommend/me`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: await req.text(),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
