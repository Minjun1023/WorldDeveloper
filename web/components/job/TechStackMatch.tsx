import { Check, Code2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function TechStackMatch({ tags, skills }: { tags: string[]; skills?: string[] }) {
  if (!tags || tags.length === 0) return null;
  const norm = (s: string) => s.trim().toLowerCase();
  const skillSet = skills ? new Set(skills.map(norm)) : null;
  const matched = skillSet ? tags.filter((t) => skillSet.has(norm(t))) : [];

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Code2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-h3">기술 스택</h2>
          <span className="text-caption text-muted-foreground">{tags.length}개</span>
        </div>
        {skillSet && (
          <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-caption font-medium text-success">
            내 프로필 매칭 {matched.length}/{tags.length}
          </span>
        )}
      </div>

      <p className="mt-1.5 text-body-sm text-muted-foreground">
        이 공고에서 다루는 기술이에요{skillSet ? ". 초록색은 내 프로필과 일치하는 항목이에요" : ""}.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((t) => {
          const hit = skillSet?.has(norm(t));
          return (
            <span
              key={t}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-mono text-body-sm lowercase",
                hit ? "border-success/40 bg-success/5 text-success" : "border-border bg-muted/40 text-foreground",
              )}
            >
              {hit && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              {t}
            </span>
          );
        })}
      </div>
    </section>
  );
}
