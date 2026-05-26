import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email") ?? "";
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/auth/check-email?email=${encodeURIComponent(email)}`,
      { cache: "no-store" },
    );
    return NextResponse.json(await res.json().catch(() => ({ valid: false, available: false })), {
      status: res.status,
    });
  } catch {
    return NextResponse.json({ valid: false, available: false }, { status: 502 });
  }
}
