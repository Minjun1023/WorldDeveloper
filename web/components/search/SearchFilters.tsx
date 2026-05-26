"use client";

import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { useUpdateQuery } from "@/lib/use-update-query";

const pillBase =
  "rounded-full border px-3 py-1 text-body-sm transition-colors";

function pillClass(active: boolean) {
  return cn(
    pillBase,
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border text-foreground hover:bg-accent",
  );
}

export function SearchFilters() {
  const searchParams = useSearchParams();
  const update = useUpdateQuery();
  const remote = searchParams.get("remote") === "true";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => update({ remote: remote ? null : "true" })}
        className={pillClass(remote)}
      >
        원격만
      </button>
    </div>
  );
}
