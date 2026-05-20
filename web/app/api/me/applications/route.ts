import { SignJWT } from "jose";
import { NextResponse } from "next/server";

import { auth } from "@/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

// NextAuth 세션 → backend 호환 JWT(HS256, JWT_SECRET 공유) 발급 → 추적 API 프록시
async function backendToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime("1h")
    .sign(secret);
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.email;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const token = await backendToken(userId);
  const res = await fetch(`${BACKEND_URL}/api/v1/applications`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.email;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const token = await backendToken(userId);
  const res = await fetch(`${BACKEND_URL}/api/v1/applications`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: await req.text(),
    cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
