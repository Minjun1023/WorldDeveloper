import { NextResponse } from "next/server";

// 프론트 → Next route → Spring 백엔드 프록시 (BACKEND_URL 은 서버 전용)
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const { job_id, resume_text } = (await req.json()) as {
    job_id?: string;
    resume_text?: string;
  };
  if (!job_id) {
    return NextResponse.json({ error: "job_id required" }, { status: 400 });
  }
  try {
    // job_id 는 raw 콜론 그대로 path 에 (encodeURIComponent 시 Tomcat 400)
    const res = await fetch(`${BACKEND_URL}/api/v1/jobs/${job_id}/resume-optimize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resume_text: resume_text ?? "" }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
