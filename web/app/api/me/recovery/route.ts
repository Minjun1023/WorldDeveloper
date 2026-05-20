import { SignJWT } from "jose";
import { NextResponse } from "next/server";

import { auth } from "@/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

// NextAuth 세션 → backend 호환 JWT(HS256, JWT_SECRET 공유) → 회복 API 프록시
async function backendToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime("1h")
    .sign(secret);
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.email;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { job_id, reason, mark_rejected } = (await req.json()) as {
    job_id?: string;
    reason?: string;
    mark_rejected?: boolean;
  };
  if (!job_id) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  const token = await backendToken(userId);
  // job_id 는 raw 콜론 그대로 path 에
  const res = await fetch(`${BACKEND_URL}/api/v1/applications/${job_id}/recovery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ reason: reason ?? "", mark_rejected: mark_rejected ?? true }),
    cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
