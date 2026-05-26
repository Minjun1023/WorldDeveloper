import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/auth/check-name?name=${encodeURIComponent(name)}`,
      { cache: "no-store" },
    );
    return NextResponse.json(await res.json().catch(() => ({ available: false })), {
      status: res.status,
    });
  } catch {
    return NextResponse.json({ available: false }, { status: 502 });
  }
}
