import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "dev-jobs-web",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
