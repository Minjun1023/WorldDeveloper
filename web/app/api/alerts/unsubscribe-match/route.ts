const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

// 프로필 매칭 알림 메일의 "그만 받기" 링크 랜딩 — alerts/unsubscribe 와 동일 패턴.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  let ok = false;
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/alerts/unsubscribe-match?token=${encodeURIComponent(token)}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    ok = res.ok;
  } catch {
    // ok=false 로 안내
  }
  const body = ok
    ? `<h1>알림이 해지되었습니다</h1><p>프로필 맞춤 공고 이메일 알림을 더 이상 보내지 않아요.</p><p><a href="/recommend">맞춤 추천으로 가기</a></p>`
    : `<h1>해지 처리에 실패했어요</h1><p>링크가 만료됐거나 이미 해지된 알림일 수 있어요.</p><p><a href="/">홈으로</a></p>`;
  return new Response(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>알림 해지 — DevPass</title><style>body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;color:#191f28;text-align:center;padding:0 24px}h1{font-size:22px}a{color:#0064ff}</style></head><body>${body}</body></html>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
