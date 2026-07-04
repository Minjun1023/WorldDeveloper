"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(92vw,32rem)] rounded-lg border border-border bg-surface p-0 text-foreground shadow-lg",
        "backdrop:bg-black/40",
      )}
    >
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 id={titleId} className="text-h3 font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div tabIndex={0} className="max-h-[60vh] overflow-y-auto p-4">{children}</div>
      <div className="flex justify-end border-t border-border p-4">
        <Button type="button" size="sm" onClick={onClose}>
          닫기
        </Button>
      </div>
    </dialog>
  );
}
