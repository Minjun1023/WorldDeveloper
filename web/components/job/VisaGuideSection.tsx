import { ExternalLink } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
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
        <div className="flex flex-wrap gap-2">
          {guide.sources.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "default" })}
            >
              {s.title}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          ))}
        </div>
      )}
      <p className="text-caption text-muted-foreground">{guide.disclaimer}</p>
    </section>
  );
}
