"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InterviewPrep } from "@/lib/types";

export function InterviewPrepSection({ prep }: { prep: InterviewPrep }) {
  const [active, setActive] = useState(0);
  const stage = prep.stages[active];

  return (
    <section className="space-y-4 rounded-lg border border-border bg-muted p-5">
      <div className="space-y-1">
        <h2 className="text-h3">인터뷰 준비</h2>
        <p className="text-body-sm text-muted-foreground">
          단계별 예상 질문과 준비 행동 + 이 공고 스택의 단골 주제입니다.
        </p>
        {prep.detected && (
          <p className="text-caption text-muted-foreground">
            이 공고{" "}
            <span className="font-medium text-foreground">{prep.detected.level}</span>
            {prep.detected.primary_stack && (
              <>
                {" · 주력 "}
                <span className="font-medium text-foreground">{prep.detected.primary_stack}</span>
              </>
            )}
            {prep.detected.remote && " · 원격"} 기준으로 조정했어요
          </p>
        )}
      </div>

      {prep.stack_specific_topics.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-body-sm font-medium">이 공고 스택 단골 주제</h3>
          <ul className="space-y-1 text-body-sm text-muted-foreground">
            {prep.stack_specific_topics.map((t) => (
              <li key={t} className="font-mono text-xs">
                · {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 스테이지 탭 */}
      <div className="flex flex-wrap gap-1.5">
        {prep.stages.map((s, i) => (
          <button
            key={s.stage}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "rounded-md px-3 py-1.5 text-body-sm transition-colors",
              i === active
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {stage && (
        <div className="space-y-4 rounded-md border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{stage.duration}</Badge>
            <span className="text-body-sm text-muted-foreground">{stage.focus}</span>
          </div>

          <div className="space-y-2">
            <h4 className="text-body-sm font-medium">예상 질문</h4>
            <ul className="space-y-1.5 text-body-sm text-foreground/90">
              {stage.common_questions.map((q, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">Q.</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-body-sm font-medium">준비 행동</h4>
            <ul className="space-y-1.5 text-body-sm text-foreground/90">
              {stage.preparation_actions.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">✓</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {prep.questions_to_ask_them.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-body-sm font-medium">역질문 (면접관에게)</h3>
          <ul className="space-y-1 text-body-sm text-muted-foreground">
            {prep.questions_to_ask_them.map((q, i) => (
              <li key={i}>· {q}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{prep.note}</p>
    </section>
  );
}
