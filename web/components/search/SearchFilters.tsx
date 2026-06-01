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

const TRACKS: { value: string | null; label: string }[] = [
  { value: null, label: "둘 다" },
  { value: "relocation", label: "이주(비자)" },
  { value: "remote", label: "원격" },
];

export function SearchFilters() {
  const searchParams = useSearchParams();
  const update = useUpdateQuery();
  const track = searchParams.get("track");
  const remote = searchParams.get("remote") === "true";
  const includeUnclear = searchParams.get("include_unclear") === "true";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {TRACKS.map((t) => {
        const active = t.value === track || (t.value === null && !track);
        return (
          <button
            key={t.label}
            type="button"
            onClick={() => update({ track: t.value })}
            className={pillClass(active)}
          >
            {t.label}
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

      <button
        type="button"
        onClick={() => update({ include_unclear: includeUnclear ? null : "true" })}
        className={pillClass(includeUnclear)}
      >
        미확인 공고 포함
      </button>
    </div>
  );
}
