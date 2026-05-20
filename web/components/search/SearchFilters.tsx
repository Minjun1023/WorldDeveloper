"use client";

import { useSearchParams } from "next/navigation";

import type { Facets } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUpdateQuery } from "@/lib/use-update-query";

const VISA_OPTIONS: { value: string | null; label: string }[] = [
  { value: null, label: "전체" },
  { value: "sponsors", label: "스폰서 가능" },
  { value: "unclear", label: "정보 없음" },
  { value: "no_sponsor", label: "스폰서 불가" },
];

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

export function SearchFilters({ facets }: { facets?: Facets }) {
  const searchParams = useSearchParams();
  const update = useUpdateQuery();

  const currentVisa = searchParams.get("visa");
  const remote = searchParams.get("remote") === "true";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {VISA_OPTIONS.map(({ value, label }) => {
        const active = value === null ? !currentVisa : currentVisa === value;
        const count = value ? facets?.visa_status?.[value] : undefined;
        return (
          <button
            key={label}
            type="button"
            onClick={() => update({ visa: value })}
            className={pillClass(active)}
          >
            {label}
            {count !== undefined ? ` (${count})` : ""}
          </button>
        );
      })}

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

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
