"use client";

import { cn } from "@/lib/utils";

export function Segmented({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <span className="block text-body-sm font-medium">{label}</span>
      {/* shadcn Tabs 트리거 룩 — muted 트랙 + 활성 세그먼트는 background 로 떠오름 */}
      <div
        role="group"
        aria-label={label}
        className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-muted p-1 text-muted-foreground"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                active
                  ? "bg-background text-foreground shadow"
                  : "hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
