"use client";

import { Bell, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function SaveSearchButton({
  params, label, loggedIn,
}: {
  params: Record<string, string | boolean | undefined>;
  label: string;
  loggedIn: boolean;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  if (!loggedIn) {
    return (
      <Link href="/signin?callbackUrl=/search"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-body-sm text-muted-foreground hover:bg-accent">
        <Bell className="h-4 w-4" aria-hidden="true" /> 이 검색 저장
      </Link>
    );
  }

  async function save() {
    if (state !== "idle") return;
    setState("saving");
    try {
      const res = await fetch("/api/me/searches", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, params }),
      });
      setState(res.ok ? "saved" : "idle");
    } catch {
      setState("idle");
    }
  }

  return (
    <button type="button" onClick={save} disabled={state !== "idle"}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-body-sm text-foreground hover:bg-accent disabled:opacity-60">
      {state === "saved" ? <><Check className="h-4 w-4 text-success" aria-hidden="true" /> 저장됨</>
        : <><Bell className="h-4 w-4" aria-hidden="true" /> {state === "saving" ? "저장 중…" : "이 검색 저장"}</>}
    </button>
  );
}
