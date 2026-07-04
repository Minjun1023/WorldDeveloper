import { NextResponse } from "next/server";

// 인기 공고 프록시(공개). region/discipline/limit 을 백엔드로 전달(Hero 와 동일한 직무 시스템).
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const b = new URL(`${BACKEND_URL}/api/v1/popular-jobs`);
  const region = sp.get("region");
  const discipline = sp.get("discipline");
  if (region) b.searchParams.set("region", region);
  if (discipline) b.searchParams.set("discipline", discipline);
  b.searchParams.set("limit", sp.get("limit") ?? "6");
  try {
    const res = await fetch(b, { cache: "no-store" });
    const data = await res.json().catch(() => []);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json([], { status: 502 });
  }
}
