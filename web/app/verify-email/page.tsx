"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function VerifyEmailInner() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"pending" | "ok" | "fail">("pending");

  useEffect(() => {
    if (!token) {
      setState("fail");
      return;
    }
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => setState(r.ok ? "ok" : "fail"))
      .catch(() => setState("fail"));
  }, [token]);

  return (
    <div className="mx-auto max-w-sm space-y-4 py-8">
      <h1 className="text-display">이메일 인증</h1>
      {state === "pending" && <p className="text-muted-foreground">인증 중…</p>}
      {state === "ok" && (
        <div className="space-y-3 text-body-sm">
          <p>이메일 인증이 완료됐어요. 이제 로그인할 수 있어요.</p>
          <Link href="/signin" className="text-primary underline">
            로그인하러 가기
          </Link>
        </div>
      )}
      {state === "fail" && (
        <div className="space-y-3 text-body-sm">
          <p className="text-destructive">
            인증 링크가 유효하지 않거나 만료됐어요. 로그인 화면에서 인증 메일을 다시 받아보세요.
          </p>
          <Link href="/signin" className="text-primary underline">
            로그인 화면으로
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">불러오는 중…</p>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
