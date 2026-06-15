"use client";

import { useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function TagInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  suggestions,
  hint,
}: {
  id: string;
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** 자동완성 후보(있으면 입력 시 드롭다운). 자유 입력도 그대로 허용. */
  suggestions?: string[];
  hint?: string;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function add(raw: string) {
    const t = raw.trim();
    setDraft("");
    setOpen(false);
    if (!t || value.some((v) => v.toLowerCase() === t.toLowerCase())) return;
    onChange([...value, t]);
  }

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q || !suggestions) return [];
    const chosen = new Set(value.map((v) => v.toLowerCase()));
    return suggestions
      .filter((s) => s.toLowerCase().includes(q) && !chosen.has(s.toLowerCase()))
      .slice(0, 8);
  }, [draft, suggestions, value]);

  const showMenu = open && matches.length > 0;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showMenu && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setActive((i) => {
        const n = matches.length;
        return e.key === "ArrowDown" ? (i + 1) % n : (i - 1 + n) % n;
      });
      return;
    }
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(showMenu ? matches[active] ?? draft : draft);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-body-sm font-medium">
          {label}
        </label>
        {hint && <span className="text-caption text-muted-foreground">{hint}</span>}
      </div>
      <div className="relative">
        <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background p-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary"
            >
              {tag}
              <button
                type="button"
                aria-label={`${tag} 제거`}
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="text-primary/60 hover:text-primary"
              >
                ✕
              </button>
            </span>
          ))}
          <input
            id={id}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              blurTimer.current = setTimeout(() => {
                setOpen(false);
                add(draft);
              }, 120);
            }}
            placeholder={value.length ? "" : placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={showMenu}
            aria-autocomplete="list"
            className="min-w-[6rem] flex-1 bg-transparent px-1 text-body-sm focus-visible:outline-none"
          />
        </div>

        {showMenu && (
          <ul
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-64 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-md"
            role="listbox"
          >
            {matches.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (blurTimer.current) clearTimeout(blurTimer.current);
                    add(s);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-1.5 text-body-sm",
                    i === active ? "bg-primary/10 text-primary" : "hover:bg-accent",
                  )}
                >
                  <span>{s}</span>
                  <span className="text-caption text-muted-foreground">+ 추가</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
