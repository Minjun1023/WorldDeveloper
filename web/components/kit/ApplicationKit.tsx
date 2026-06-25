"use client";

import Link from "next/link";

// 백엔드 응답은 전역 Jackson SNAKE_CASE 라 모든 키가 snake_case 다.
// (skill_gap, synthesis.fit_summary/skill_strategy/cover_letter/interview_questions,
//  job.company.display_name). 코치 링크의 ?jobId= 만 URL 쿼리 규약(camel)을 따른다.
export type Kit = {
  job: { id: string; title: string; company: { display_name: string } };
  visa: {
    confidence: string;
    message: string;
    guide?: {
      text: string;
      sources: { title: string; url: string; retrieved_at: string }[];
      disclaimer: string;
    } | null;
  };
  skill_gap: { required: string[]; present: string[]; missing: string[] };
  synthesis: {
    fit_summary: string;
    skill_strategy: string;
    cover_letter: string;
    interview_questions: string[];
  } | null;
};

const VISA_BADGE: Record<string, string> = {
  verified: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  likely: "bg-primary/10 text-primary",
  unclear: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  none: "bg-destructive/10 text-destructive",
};

function Section({
  title,
  jobId,
  children,
}: {
  title: string;
  jobId: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-body font-semibold text-foreground">{title}</h2>
        <Link
          href={`/coach?jobId=${encodeURIComponent(jobId)}`}
          className="shrink-0 rounded-md text-caption text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          다듬기
        </Link>
      </div>
      <div className="mt-2 whitespace-pre-wrap text-body-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export function ApplicationKit({ kit }: { kit: Kit }) {
  const jobId = kit.job.id;
  const badge = VISA_BADGE[kit.visa.confidence] ?? "bg-surface-2 text-muted-foreground";

  return (
    <div className="flex w-full flex-col gap-4">
      <Section title="비자 스폰서십" jobId={jobId}>
        <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-caption font-medium ${badge}`}>
          {kit.visa.confidence}
        </span>
        {kit.visa.message}
        {kit.visa.guide ? (
          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            <p className="whitespace-pre-line text-body text-foreground">{kit.visa.guide.text}</p>
            {kit.visa.guide.sources.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {kit.visa.guide.sources.map((s) => (
                  <li key={s.url} className="text-caption">
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                       className="text-primary underline underline-offset-2">
                      {s.title}
                    </a>
                    <span className="text-muted-foreground"> · {s.retrieved_at} 확인</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-caption text-muted-foreground">{kit.visa.guide.disclaimer}</p>
          </div>
        ) : null}
      </Section>

      <Section title="공고 요구 중 미보유 스킬" jobId={jobId}>
        {kit.skill_gap.missing.length
          ? kit.skill_gap.missing.join(", ")
          : "없음 (요구 스킬 대부분 보유)"}
      </Section>

      {kit.synthesis ? (
        <>
          <Section title="적합도" jobId={jobId}>
            {kit.synthesis.fit_summary}
          </Section>
          <Section title="스킬 보완 전략" jobId={jobId}>
            {kit.synthesis.skill_strategy}
          </Section>
          <Section title="커버레터 초안" jobId={jobId}>
            {kit.synthesis.cover_letter}
          </Section>
          <Section title="예상 면접 질문" jobId={jobId}>
            <ul className="list-disc space-y-1 pl-5">
              {kit.synthesis.interview_questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </Section>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-4 text-body-sm text-muted-foreground">
          AI 합성에 일시적으로 실패해 공고·비자·스킬갭만 먼저 보여드려요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}
