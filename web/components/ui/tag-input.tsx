"use client";

import { useState } from "react";

export function TagInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const t = raw.trim();
    setDraft("");
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-body-sm font-medium">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background p-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-caption"
          >
            {tag}
            <button
              type="button"
              aria-label={`${tag} 제거`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[6rem] flex-1 bg-transparent px-1 text-body-sm focus-visible:outline-none"
        />
      </div>
    </div>
  );
}
