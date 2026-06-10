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
      <div
        role="group"
        aria-label={label}
        className="inline-flex flex-wrap gap-0.5 rounded-md border border-border p-0.5"
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
                "rounded px-3 py-1 text-body-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
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
