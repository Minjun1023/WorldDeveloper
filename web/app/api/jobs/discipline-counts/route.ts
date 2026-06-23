import { NextResponse } from "next/server";

import { DISCIPLINES } from "@/lib/disciplines";

// 직무(discipline)별 공고 수 — 기존 검색 엔드포인트(discipline 필터 + total)를 직무마다 호출해 집계.
// 서버에서만 백엔드에 닿으므로 Next 라우트로 프록시. 5분 캐시.
export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET() {
  const entries = await Promise.all(
    DISCIPLINES.map(async (d) => {
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/v1/jobs?discipline=${encodeURIComponent(d.value)}&page_size=1`,
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
