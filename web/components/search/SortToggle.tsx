"use client";

import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { useUpdateQuery } from "@/lib/use-update-query";

const pillBase = "rounded-full border px-3 py-1 text-body-sm transition-colors";

function pillClass(active: boolean) {
  return cn(
    pillBase,
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border text-foreground hover:bg-accent",
  );
}

export function SortToggle() {
  const searchParams = useSearchParams();
  const update = useUpdateQuery();
  const sort = searchParams.get("sort");
  const isRecent = sort === "recent";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => update({ sort: null })}
        className={pillClass(!isRecent)}
      >
        관련도순
      </button>
      <button
        type="button"
        onClick={() => update({ sort: "recent" })}
        className={pillClass(isRecent)}
      >
        최신순
      </button>
    </div>
  );
}
