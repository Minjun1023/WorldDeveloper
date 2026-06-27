"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type DropdownOption = { value: string; label: string; count?: number };

export function Dropdown({
  placeholder,
  options,
  value,
  onSelect,
}: {
  placeholder: string;
  options: DropdownOption[];
  value: string | null;
  onSelect: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-body-sm",
          selected ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>
      {open && (
        <div role="listbox" className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-md">
          <button
            type="button"
            role="option"
            aria-selected={value === null}
            onClick={() => { onSelect(null); setOpen(false); }}
            className={cn(
              "flex w-full items-center px-3 py-1.5 text-body-sm hover:bg-accent",
              value === null && "font-medium text-primary",
            )}
          >
            전체
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={value === o.value}
              onClick={() => { onSelect(o.value); setOpen(false); }}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-body-sm hover:bg-accent",
                value === o.value && "font-medium text-primary",
              )}
            >
              <span className="truncate">{o.label}</span>
              {o.count !== undefined && (
                <span className="text-caption text-muted-foreground">{o.count}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
