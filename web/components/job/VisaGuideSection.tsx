import type { VisaGuide } from "@/lib/types";

export function VisaGuideSection({ guide }: { guide: VisaGuide }) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface-2 p-5">
      <div className="space-y-1">
        <h2 className="text-h3">비자 가이드</h2>
        <p className="text-body-sm text-muted-foreground">
          이 공고 국가에서 한국 개발자가 스폰서받는 경로입니다.
        </p>
      </div>
      <p className="whitespace-pre-line text-body-sm text-foreground/90">{guide.text}</p>
      {guide.sources.length > 0 && (
        <ul className="space-y-1">
          {guide.sources.map((s) => (
            <li key={s.url} className="text-caption">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                {s.title}
              </a>
              <span className="text-muted-foreground"> · {s.retrieved_at} 확인</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-caption text-muted-foreground">{guide.disclaimer}</p>
    </section>
  );
}
