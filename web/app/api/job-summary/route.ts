import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const { job_id, lang } = (await req.json()) as { job_id?: string; lang?: string };
  if (!job_id) {
    return NextResponse.json({ error: "job_id required" }, { status: 400 });
  }
  const target = lang === "en" ? "en" : "ko";  // 화이트리스트 — 임의 쿼리 파라미터 주입 차단
  // 백엔드 레이트리밋이 IP당 카운트하도록 실제 클라이언트 IP 를 전달한다.
  const fwd =
    req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
  try {
    const res = await fetch(
      // job_id 인코딩 — '../actuator/env' 같은 경로 조작으로 백엔드 내부 엔드포인트 접근 차단
      `${BACKEND_URL}/api/v1/jobs/${encodeURIComponent(job_id)}/summary?lang=${target}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(75_000),
        headers: fwd ? { "X-Forwarded-For": fwd } : {},
      },
    );
    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
