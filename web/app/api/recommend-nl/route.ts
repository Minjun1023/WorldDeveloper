import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const body = await req.text();
  const fwd =
    req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/recommend/nl`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": fwd },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
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
