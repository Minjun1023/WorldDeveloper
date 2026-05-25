"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkPassword, isPasswordValid } from "@/lib/password";
import { PasswordChecklist } from "@/components/auth/PasswordChecklist";

type Mode = "login" | "register";

export function CredentialsForm({
  mode,
  callbackUrl = "/",
}: {
  mode: Mode;
  callbackUrl?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, display_name: displayName }),
        });
        if (!res.ok) throw new Error("가입에 실패했어요. 잠시 후 다시 시도해 주세요.");
        setRegistered(true);
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (res.status === 403) {
          throw new Error("이메일 인증이 필요해요. 받은 인증 메일의 링크를 눌러주세요.");
        }
        if (!res.ok) throw new Error("이메일 또는 비밀번호가 올바르지 않아요.");
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했어요.");
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setError(null);
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
  }

  if (mode === "register" && registered) {
    return (
      <div className="space-y-3 text-body-sm">
        <p>
          <strong>{email}</strong> 로 인증 메일을 보냈어요. 메일의 링크를 눌러 이메일을
          인증한 뒤 로그인하세요.
        </p>
        <button type="button" onClick={resend} className="text-primary underline">
          인증 메일 다시 보내기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {mode === "register" && (
        <Input
          type="text"
          placeholder="이름"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
      )}
      <Input
        type="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder={
          mode === "register" ? "비밀번호 (최소 10자, 대/소문자·숫자 포함)" : "비밀번호"
        }
        minLength={mode === "register" ? 10 : undefined}
        maxLength={mode === "register" ? 72 : undefined}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {mode === "register" && <PasswordChecklist checks={checkPassword(password)} />}
      {error && <p className="text-destructive text-body-sm">{error}</p>}
      <Button
        type="submit"
        disabled={pending || (mode === "register" && !isPasswordValid(password))}
        className="w-full"
      >
        {pending ? "처리 중…" : mode === "register" ? "가입하기" : "로그인"}
      </Button>
    </form>
  );
}
