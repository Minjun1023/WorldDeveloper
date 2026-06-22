"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 프로필 하단 위험 구역: 회원탈퇴. 비번 계정은 현재 비번 재확인, OAuth 전용은 'DELETE' 입력.
export function WithdrawSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/me/account/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: password || null, confirm: confirm || null }),
      });
      if (res.status === 403) throw new Error("확인에 실패했어요. 비밀번호 또는 확인 문구를 다시 확인해 주세요.");
      if (!res.ok) throw new Error("탈퇴에 실패했어요. 잠시 후 다시 시도해 주세요.");
      // 세션 쿠키는 라우트에서 제거됨. 홈으로 이동.
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-10 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5">
      <h2 className="text-body font-semibold text-destructive">회원탈퇴</h2>
      <p className="mt-1 text-body-sm text-muted-foreground">
        탈퇴하면 프로필·북마크·코치 대화·작성한 글이 모두 삭제되며 복구할 수 없어요.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-lg border border-destructive/40 px-4 py-2 text-body-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          회원탈퇴
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="withdraw-pw" className="text-body-sm font-medium">
              비밀번호 확인
            </label>
            <PasswordInput
              id="withdraw-pw"
              placeholder="현재 비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
            />
            <p className="text-caption text-muted-foreground">
              소셜 로그인으로 가입해 비밀번호가 없다면, 아래에 <strong>DELETE</strong> 를 입력하세요.
            </p>
            <Input
              placeholder="DELETE"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-11"
            />
          </div>
          {error && <p className="text-body-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={withdraw}
              disabled={pending || (!password && confirm !== "DELETE")}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending ? "처리 중…" : "영구 삭제"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
                setPassword("");
                setConfirm("");
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
