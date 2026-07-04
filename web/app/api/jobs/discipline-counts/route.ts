import { NextResponse } from "next/server";

import { DISCIPLINES } from "@/lib/disciplines";

// 직무(discipline)별 공고 수 — 기존 검색 엔드포인트(discipline 필터 + total)를 직무마다 호출해 집계.
// region(국가 ISO2/도시 slug)이 오면 그 지역으로 스코프해 집계(지역별 직무 분포). 서버 전용 프록시.
export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET(req: Request) {
  const region = new URL(req.url).searchParams.get("region");
  const regionQs = region ? `&region=${encodeURIComponent(region)}` : "";
  const entries = await Promise.all(
    DISCIPLINES.map(async (d) => {
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/v1/jobs?discipline=${encodeURIComponent(d.value)}${regionQs}&page_size=1`,
          { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) return [d.value, null] as const;
        const data = (await res.json()) as { total?: unknown };
        return [d.value, typeof data.total === "number" ? data.total : null] as const;
      } catch {
        return [d.value, null] as const;
      }
    }),
  );
  return NextResponse.json(Object.fromEntries(entries));
}
