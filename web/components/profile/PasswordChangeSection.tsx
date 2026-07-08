"use client";

import { useState } from "react";

import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { checkPassword, isPasswordValid } from "@/lib/password";

// 프로필 하단 계정 관리: 비밀번호 변경. 현재 비밀번호 재확인 후 새 비밀번호로 교체.
// 소셜 로그인 전용 계정(비밀번호 없음)은 백엔드가 409 를 주므로 안내만 한다.
export function PasswordChangeSection() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = current.length > 0 && isPasswordValid(next) && next === confirm && !pending;

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  }

  async function submit() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/me/account/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (res.status === 403) throw new Error("현재 비밀번호가 올바르지 않아요.");
      if (res.status === 409) throw new Error("소셜 로그인으로 가입한 계정은 비밀번호가 없어요.");
      if (res.status === 400) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(
          body?.message === "same_password"
            ? "새 비밀번호가 기존 비밀번호와 같아요."
            : "새 비밀번호가 요건을 충족하지 않아요.",
        );
      }
      if (!res.ok) throw new Error("변경에 실패했어요. 잠시 후 다시 시도해 주세요.");
      reset();
      setOpen(false);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-10 rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-body font-semibold">비밀번호 변경</h2>
      <p className="mt-1 text-body-sm text-muted-foreground">
        현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿔요. 소셜 로그인 계정은 해당되지 않아요.
      </p>

      {done && !open && <p className="mt-3 text-body-sm text-success">비밀번호가 변경됐어요.</p>}

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
          className="mt-3 rounded-lg border border-border px-4 py-2 text-body-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          비밀번호 변경
        </button>
      ) : (
        <div className="mt-4 max-w-sm space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="chpw-current" className="text-body-sm font-medium">
              현재 비밀번호
            </label>
            <PasswordInput
              id="chpw-current"
              placeholder="현재 비밀번호"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="chpw-new" className="text-body-sm font-medium">
              새 비밀번호
            </label>
            <PasswordInput
              id="chpw-new"
              placeholder="영문 대·소문자, 숫자 포함 10자 이상"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="h-11"
            />
            {next.length > 0 && !isPasswordValid(next) && (
              <PasswordChecklist checks={checkPassword(next)} />
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="chpw-confirm" className="text-body-sm font-medium">
              새 비밀번호 확인
            </label>
            <PasswordInput
              id="chpw-confirm"
              placeholder="새 비밀번호를 다시 입력해주세요"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-11"
            />
            {mismatch && <p className="text-caption text-destructive">새 비밀번호가 서로 달라요.</p>}
          </div>
          {error && <p className="text-body-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" onClick={submit} disabled={!canSubmit}>
              {pending ? "변경 중…" : "변경하기"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="rounded-lg border border-border px-4 py-2 text-body-sm text-foreground hover:bg-accent"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
