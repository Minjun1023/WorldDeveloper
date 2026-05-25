import { NextResponse } from "next/server";

import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/signin?error=oauth", APP_BASE_URL));
  }

  const res = await fetch(`${BACKEND_URL}/api/v1/auth/exchange`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Internal-Auth": process.env.INTERNAL_AUTH_SECRET ?? "",
    },
    body: JSON.stringify({ code }),
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.redirect(new URL("/signin?error=oauth", APP_BASE_URL));
  }

  const data = (await res.json()) as { token: string };
  const out = NextResponse.redirect(new URL("/", APP_BASE_URL));
  out.cookies.set(SESSION_COOKIE, data.token, sessionCookieOptions());
  return out;
}
