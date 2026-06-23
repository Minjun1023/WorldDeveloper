"use client";

import { Search } from "lucide-react";
import { useRef, useState } from "react";

import { HeroSearchModal } from "@/components/home/HeroSearchModal";
import type { RegionCount } from "@/lib/api";

// 히어로 검색 바: 클릭하면 통합 검색 모달(검색어 + 지역 + 직무)이 이 바 위치에 겹쳐 뜬다.
export function HeroSearch({ regions = [] }: { regions?: RegionCount[] }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openModal = () => {
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openModal}
        aria-haspopup="dialog"
        className="mt-8 flex w-full max-w-2xl items-center rounded-lg border border-border bg-surface p-2.5 text-left transition-colors hover:border-primary/40"
      >
        <span className="flex h-11 min-w-0 flex-1 items-center gap-2 px-2 text-hint">
          <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="truncate text-body">어떤 일을 찾고 계세요? (예: React, 백엔드, ML)</span>
        </span>
      </button>
      {open && <HeroSearchModal regions={regions} anchorRect={rect} onClose={() => setOpen(false)} />}
    </>
  );
}
