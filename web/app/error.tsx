"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

// 라우트 세그먼트 에러 바운더리 — 서버/클라이언트 컴포넌트 렌더 throw 를
// 흰 화면 대신 한국어 폴백으로. reset() 으로 해당 세그먼트 재시도.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 운영 로깅 훅(추후 Sentry 등 연결 지점)
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-h3 font-semibold text-foreground">문제가 발생했어요</h1>
      <p className="mt-2 max-w-sm text-body-sm text-muted-foreground">
        일시적인 오류로 페이지를 표시하지 못했어요. 잠시 후 다시 시도해주세요.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button type="button" size="sm" onClick={reset}>
          다시 시도
        </Button>
        <Link
          href="/"
          className="inline-flex h-12 items-center rounded-lg border border-border px-4 text-body-sm font-bold text-foreground transition-colors hover:bg-accent"
        >
          홈으로
        </Link>
      </div>
    </main>
  );
}
