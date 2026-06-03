import { NextResponse } from "next/server";

import { profileResponseSchema, recommendProfileSchema } from "@/lib/schemas";
import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      // 백엔드 응답이 계약과 다르면(드리프트) 깨진 데이터를 흘리지 않고 502 로 막는다.
      const parsed = profileResponseSchema.safeParse(data);
      if (!parsed.success) {
        return NextResponse.json({ error: "프로필 응답 형식이 올바르지 않아요." }, { status: 502 });
      }
      return NextResponse.json(parsed.data, { status: 200 });
    }
    return NextResponse.json(data ?? {}, { status: res.status });
  } catch {
    return NextResponse.json({ error: "프로필 서버에 연결할 수 없어요." }, { status: 502 });
  }
}

export async function PUT(req: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  // 입력 검증: 잘못된 프로필은 백엔드로 보내지 않고 400 으로 거절.
  const input = recommendProfileSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: "invalid_profile", issues: input.error.flatten() }, { status: 400 });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/profile`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(input.data),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "프로필 서버에 연결할 수 없어요." }, { status: 502 });
  }
}
