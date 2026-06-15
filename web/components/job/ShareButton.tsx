"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

// 공유: 가능하면 네이티브 공유 시트(navigator.share — 모바일에서 카톡·메시지 등으로 바로 공유).
// 미지원(대부분 데스크톱) 또는 사용자가 취소하면 주소 복사로 폴백한다.
export function ShareButton({ title }: { title?: string } = {}) {
  const [copied, setCopied] = useState(false);

  async function copyFallback() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 차단 환경: 무시 */
    }
  }

  async function share() {
    const data = { title: title ?? document.title, url: window.location.href };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(data);
        return;
      } catch (e) {
        // 사용자가 공유 시트를 닫으면 AbortError — 폴백하지 않고 조용히 종료.
        if (e instanceof DOMException && e.name === "AbortError") return;
        // 그 외(공유 실패)는 복사로 폴백.
      }
    }
    await copyFallback();
  }

  return (
    <button
      type="button"
      onClick={share}
      className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-border text-body-sm font-semibold hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Share2 className="h-4 w-4" aria-hidden="true" />
      {copied ? "주소 복사됨" : "공유"}
    </button>
  );
}
