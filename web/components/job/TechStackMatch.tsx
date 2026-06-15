import { Badge } from "@/components/ui/badge";

export function TechStackMatch({ tags, skills }: { tags: string[]; skills?: string[] }) {
  if (!tags || tags.length === 0) return null;
  const norm = (s: string) => s.trim().toLowerCase();
  const skillSet = skills ? new Set(skills.map(norm)) : null;
  const matched = skillSet ? tags.filter((t) => skillSet.has(norm(t))) : [];
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-h3">기술 스택</h2>
        {skillSet && (
          <span className="text-caption text-muted-foreground">내 프로필 매칭 {matched.length}/{tags.length}</span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((t) => {
          const hit = skillSet?.has(norm(t));
          return (
            <Badge key={t} variant="outline" className={`font-mono lowercase ${hit ? "border-success/40 text-success" : ""}`}>
              {hit ? "✓ " : ""}{t}
            </Badge>
          );
        })}
      </div>
    </section>
  );
}
