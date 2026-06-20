"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 인증번호 방식 독립 인증 페이지(가입 탭을 닫았을 때의 폴백).
// 가입 화면(CredentialsForm)에서 바로 인증하는 게 기본 경로이고, 여기서도 이메일+코드로 인증할 수 있다.
export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function verify() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code: code.trim() }),
      });
      if (res.status === 429) throw new Error("시도가 너무 많아요. 잠시 후 다시 시도해 주세요.");
      if (!res.ok) throw new Error("인증번호가 올바르지 않거나 만료됐어요.");
      router.push("/signin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요.");
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setError(null);
    setResent(false);
    setCode("");
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResent(true);
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 py-8">
      <h1 className="text-display">이메일 인증</h1>
      <p className="text-body-sm text-muted-foreground">
        가입한 이메일과 받은 6자리 인증번호를 입력하세요.
      </p>
      <Input
        type="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11"
      />
      <Input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="6자리 인증번호"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="h-11 text-center text-lg tracking-[0.4em]"
      />
      {error && <p className="text-destructive text-body-sm">{error}</p>}
      {resent && !error && <p className="text-caption text-success">인증번호를 다시 보냈어요.</p>}
      <Button
        type="button"
        onClick={verify}
        disabled={pending || code.length !== 6 || !email}
        className="h-11 w-full"
      >
        {pending ? "확인 중…" : "인증하기"}
      </Button>
      <div className="flex items-center justify-between">
        <button type="button" onClick={resend} className="text-body-sm text-primary underline">
          인증번호 다시 보내기
        </button>
        <Link href="/signin" className="text-body-sm text-muted-foreground underline">
          로그인 화면으로
        </Link>
      </div>
    </div>
  );
}
