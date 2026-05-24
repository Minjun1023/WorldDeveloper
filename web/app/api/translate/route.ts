import { NextResponse } from "next/server";

// 프론트 → Next route → Spring 백엔드 프록시 (BACKEND_URL 은 서버 전용)
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const { job_id, lang } = (await req.json()) as { job_id?: string; lang?: string };
  if (!job_id) {
    return NextResponse.json({ error: "job_id required" }, { status: 400 });
  }
  const target = lang ?? "ko";
  try {
    // job_id 는 raw 콜론 그대로 path 에. 번역은 LLM 호출이라 타임아웃 여유있게.
    const res = await fetch(
      `${BACKEND_URL}/api/v1/jobs/${job_id}/translation?lang=${target}`,
      { cache: "no-store", signal: AbortSignal.timeout(75_000) },
    );
    if (!res.ok) {
      // 503(번역 미설정/업스트림) · 404 등은 상태코드만 전달
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
