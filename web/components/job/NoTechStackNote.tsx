import { Code2 } from "lucide-react";

// 기술 스택이 명시되지 않은 공고용 폴백 — 빈 영역 대신 정직한 안내.
export function NoTechStackNote() {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Code2 className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="text-h3">기술 스택</h2>
      </div>
      <p className="mt-1.5 text-body-sm text-muted-foreground">
        이 공고는 기술 스택을 별도로 명시하지 않았어요.
      </p>
    </section>
  );
}
