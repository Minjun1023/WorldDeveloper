import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/searches`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    const data = await res.json().catch(() => []);
    // 백엔드는 SNAKE_CASE(new_count/last_seen_at). 프론트(페이지·/me 허브·알림벨)는 camelCase 를
    // 기대하므로 여기서 정규화한다(이 변환 부재로 "새 공고" 카운트가 표시되지 않던 버그 수정).
    const shaped = Array.isArray(data)
      ? data.map((s: Record<string, unknown>) => ({
          ...s,
          newCount: (s.new_count as number | undefined) ?? 0,
          lastSeenAt: s.last_seen_at,
        }))
      : data;
    return NextResponse.json(shaped, { status: res.status });
  } catch {
    return NextResponse.json({ error: "불러올 수 없어요." }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/searches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: await req.text(), cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "저장할 수 없어요." }, { status: 502 });
  }
}
