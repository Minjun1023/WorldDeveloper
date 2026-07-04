import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

// 저장 검색 삭제(알림 버튼 토글 해제).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/me/searches/${encodeURIComponent(params.id)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    return new NextResponse(null, { status: res.status });
  } catch {
    return NextResponse.json({ error: "삭제할 수 없어요." }, { status: 502 });
  }
}
