import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/session";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";

export async function POST() {
  const out = NextResponse.redirect(new URL("/", APP_BASE_URL), { status: 303 });
  out.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return out;
}
