"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REASONS = ["스팸·광고", "욕설·혐오", "허위·사기 정보", "기타"];

type Phase = "form" | "submitting" | "done" | "error";

// 신고 모달. 사유 선택 + 자세한 내용(선택) → POST /api/community/reports.
// 응답에 따라 정직한 결과 표시(접수/이미 신고함/자동 숨김/실패). 자동 숨김 시 onHidden 호출.
export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
  onHidden,
}: {
  open: boolean;
  onClose: () => void;
  targetType: "post" | "comment";
  targetId: string;
  onHidden?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [reason, setReason] = useState(REASONS[0]);
  const [detail, setDetail] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [message, setMessage] = useState("");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  function handleClose() {
    const wasHidden = hidden;
    setReason(REASONS[0]);
    setDetail("");
    setPhase("form");
    setMessage("");
    setHidden(false);
    onClose();
    if (wasHidden) onHidden?.();
  }

  async function submit() {
    setPhase("submitting");
    const text = detail.trim() ? `${reason}: ${detail.trim()}` : reason;
    try {
      const res = await fetch("/api/community/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, reason: text }),
      });
      if (!res.ok) {
        setPhase("error");
        setMessage(
          res.status === 401
            ? "로그인이 필요해요."
            : res.status === 429
              ? "신고가 너무 잦아요. 잠시 후 다시 시도해주세요."
              : "신고 접수에 실패했어요. 잠시 후 다시 시도해주세요.",
        );
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { already_reported?: boolean; auto_hidden?: boolean };
      setPhase("done");
      if (d.already_reported) {
        setMessage("이미 신고한 글이에요.");
      } else if (d.auto_hidden) {
        setHidden(true);
        setMessage("신고가 접수됐어요. 신고가 누적되어 이 글은 숨김 처리됐어요.");
      } else {
        setMessage("신고가 접수됐어요. 신고가 누적되면 자동으로 숨겨지고 검토됩니다.");
      }
    } catch {
      setPhase("error");
      setMessage("신고 접수에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  }

  const finished = phase === "done" || phase === "error";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === ref.current) handleClose();
      }}
      className={cn(
        "m-auto w-[min(92vw,30rem)] rounded-lg border border-border bg-card p-0 text-foreground shadow-lg",
        "backdrop:bg-black/40",
      )}
    >
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 id={titleId} className="text-h3 font-semibold">신고하기</h2>
        <button type="button" onClick={handleClose} aria-label="닫기" className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        {finished ? (
          <p className="text-body-sm text-foreground">{message}</p>
        ) : (
          <>
            <p className="text-body-sm text-muted-foreground">
              신고 사유를 선택해주세요. 접수된 신고가 일정 수 이상 쌓이면 글이 자동으로 숨겨집니다.
            </p>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-caption font-medium transition-colors",
                    reason === r ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="자세한 내용(선택)"
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-border p-4">
        {finished ? (
          <>
            {phase === "error" && (
              <Button type="button" variant="outline" onClick={() => setPhase("form")}>
                다시 시도
              </Button>
            )}
            <Button type="button" onClick={handleClose}>
              확인
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={handleClose}>
              취소
            </Button>
            <Button type="button" onClick={submit} disabled={phase === "submitting"}>
              {phase === "submitting" ? "접수 중…" : "신고 제출"}
            </Button>
          </>
        )}
      </div>
    </dialog>
  );
}
