import { getSessionToken } from "@/lib/session-server";

// Spring 의 스트리밍 코치 응답(평문 청크)을 브라우저로 그대로 흘린다(Node 런타임).
export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";
const MAX_BODY = 300_000; // AI 비용 경로 — 거대 페이로드 조기 차단(정상 코치 본문은 통과)

export async function POST(req: Request) {
  const token = await getSessionToken();
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const body = await req.text();
  if (body.length > MAX_BODY) {
    return new Response(JSON.stringify({ error: "요청이 너무 큽니다." }), {
      status: 413,
      headers: { "content-type": "application/json" },
    });
  }
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/coach/stream`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body,
      // 스트리밍이라 타임아웃을 두지 않는다(긴 응답).
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      return new Response(text || JSON.stringify({ error: "상담 서버 오류" }), {
        status: res.ok ? 502 : res.status,
        headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
      });
    }
    return new Response(res.body, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "상담 서버에 연결할 수 없어요." }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
