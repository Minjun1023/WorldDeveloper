"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

// 데이터 로드 실패 공통 안내 — "조용한 실패" 방지 규약.
// 네트워크 오류를 빈 목록("공고가 없어요")으로 위장하지 않고, 실패임을 알리고 재시도를 준다.
export function LoadError({
  message = "불러오지 못했어요",
  onRetry,
  compact = false,
}: {
  message?: string;
  onRetry?: () => void;
  /** 섹션 내 소형 표시(카드 없이 한 줄). */
  compact?: boolean;
}) {
  const retryBtn = onRetry && (
    <Button type="button" variant="ghost" size="sm" onClick={onRetry} className="text-primary">
      <RotateCcw aria-hidden="true" />
      다시 시도
    </Button>
  );

  if (compact) {
    return (
      <p className="flex items-center gap-2 text-body-sm text-muted-foreground">
        {message}
        {retryBtn}
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card p-6 text-center">
      <p className="text-body-sm text-muted-foreground">{message}</p>
      {retryBtn && <div className="mt-2 flex justify-center">{retryBtn}</div>}
    </div>
  );
}
