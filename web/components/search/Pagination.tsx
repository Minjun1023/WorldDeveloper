"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { useUpdateQuery } from "@/lib/use-update-query";

const BLOCK = 5; // 페이지 번호 버튼 묶음 단위(5개씩 노출)

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
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => goTo(1)} aria-label="첫 페이지">
          «
        </Button>
        <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => goTo(current - 1)}>
          이전
        </Button>
        {pages.map((p) => (
          <Button
            key={p}
            variant={p === current ? "primary" : "outline"}
            size="sm"
            aria-current={p === current ? "page" : undefined}
            onClick={() => goTo(p)}
            className="min-w-[2.25rem] px-2 tabular-nums"
          >
            {p}
          </Button>
        ))}
        <Button variant="outline" size="sm" disabled={current >= totalPages} onClick={() => goTo(current + 1)}>
          다음
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={current >= totalPages}
          onClick={() => goTo(totalPages)}
          aria-label="마지막 페이지"
        >
          »
        </Button>
      </div>

      <form onSubmit={onJump} className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/[^0-9]/g, ""))}
          aria-label="이동할 페이지 번호"
          className="h-8 w-16 rounded-md border border-input bg-surface px-2 text-center tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="tabular-nums">/ {totalPages}</span>
        <Button type="submit" variant="outline" size="sm">
          이동
        </Button>
      </form>
    </div>
  );
}
