import { NextResponse } from "next/server";

// 프론트 → Next route → Spring 백엔드 프록시 (BACKEND_URL 은 서버 전용).
// 지역 선택 팝오버에서 국가 클릭 시 해당 국가의 도시별 건수를 지연 로드.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET(req: Request) {
  const country = new URL(req.url).searchParams.get("country");
  if (!country) {
    return NextResponse.json([]);
  }
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/jobs/regions/cities?country=${encodeURIComponent(country)}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) {
      return NextResponse.json([]);
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json([]);
  }
}
