import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/jobs/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: "not found" }, { status: res.status });
    return NextResponse.json(await res.json(), { status: 200 });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
