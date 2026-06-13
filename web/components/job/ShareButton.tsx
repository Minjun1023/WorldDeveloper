"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

export function ShareButton() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 차단 환경: 무시 */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-border text-body-sm font-semibold hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Share2 className="h-4 w-4" aria-hidden="true" />
      {copied ? "복사됨" : "공유"}
    </button>
  );
}
