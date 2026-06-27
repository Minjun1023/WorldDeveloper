"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

// 상세 페이지용 '이전으로' 버튼. 브레드크럼(홈 > 섹션)이 섹션 루트로 보내는 것과 달리,
// 직전에 보던 페이지(검색 결과+스크롤 위치 등)로 정확히 되돌린다.
// 직접 진입(히스토리 없음) 시엔 fallbackHref 로 안전하게 이동.
export function BackButton({ fallbackHref = "/", label = "뒤로" }: { fallbackHref?: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className="inline-flex items-center gap-1 rounded-md text-body-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
