"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type FormEvent, useState } from "react";

import { cn } from "@/lib/utils";
import { useUpdateQuery } from "@/lib/use-update-query";

const BLOCK = 5; // 페이지 번호 버튼 묶음 단위(5개씩 노출)

const ARROW =
  "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40";

export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const update = useUpdateQuery();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [input, setInput] = useState("");

  if (totalPages <= 1) return null;

  const current = Math.min(Math.max(1, page), totalPages);
  const goTo = (p: number) => {
    const clamped = Math.min(Math.max(1, p), totalPages);
    update({ page: clamped <= 1 ? null : String(clamped) });
  };

  // 5개 단위 블록(1–5, 6–10, …) 중 현재 페이지가 속한 블록만 노출.
  const blockStart = Math.floor((current - 1) / BLOCK) * BLOCK + 1;
  const blockEnd = Math.min(blockStart + BLOCK - 1, totalPages);
  const pages: number[] = [];
  for (let p = blockStart; p <= blockEnd; p++) pages.push(p);

  const onJump = (e: FormEvent) => {
    e.preventDefault();
    const n = Number.parseInt(input, 10);
    if (!Number.isNaN(n)) goTo(n);
    setInput("");
  };

  return (
    <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center sm:gap-6">
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          disabled={current <= 1}
          onClick={() => goTo(current - 1)}
          aria-label="이전 페이지"
          className={ARROW}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            aria-current={p === current ? "page" : undefined}
            onClick={() => goTo(p)}
            className={cn(
              "h-10 w-10 rounded-lg border text-body-sm font-medium tabular-nums transition-colors",
              p === current
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-foreground hover:bg-accent",
            )}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          disabled={current >= totalPages}
          onClick={() => goTo(current + 1)}
          aria-label="다음 페이지"
          className={ARROW}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={onJump} className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/[^0-9]/g, ""))}
          aria-label="이동할 페이지 번호"
          placeholder="페이지"
          className="h-9 w-16 rounded-lg border border-input bg-surface px-2 text-center tabular-nums text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="tabular-nums">/ {totalPages}</span>
        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 font-medium text-foreground transition-colors hover:bg-accent"
        >
          이동
        </button>
      </form>
    </div>
  );
}
