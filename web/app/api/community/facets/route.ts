import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

// facet 집계(공개) — 카테고리/국가/태그 카운트. 사이드바·탭 카운트용.
export async function GET() {
  const empty = { categories: [], countries: [], tags: [] };
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/community/facets`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json().catch(() => empty);
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json(empty, { status: 200 });
  }
}
