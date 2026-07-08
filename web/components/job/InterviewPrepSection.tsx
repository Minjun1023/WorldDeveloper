"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InterviewPrep } from "@/lib/types";

// "Python: GIL, async" 형태의 주제 문자열을 카테고리/내용으로 분리(콜론 없으면 전체가 내용).
function splitTopic(t: string): { category: string | null; body: string } {
  const i = t.indexOf(":");
  if (i < 0) return { category: null, body: t };
  return { category: t.slice(0, i).trim(), body: t.slice(i + 1).trim() };
}

// 인터뷰 준비 — 채용 단계가 '순서'라는 걸 살린 세로 타임라인(2026-07 리디자인).
// 데스크톱: 좌측 번호 스텝퍼 + 우측 단계 콘텐츠. 모바일: 가로 스크롤 번호 칩으로 강등.
// 단골 주제·역질문은 하단 카드 2장으로 분리해 mono 원시 리스트/방치된 불릿을 정리.
export function InterviewPrepSection({ prep }: { prep: InterviewPrep }) {
  const [active, setActive] = useState(0);
  const stage = prep.stages[active];

  return (
    <section className="space-y-5 rounded-lg border border-border bg-muted p-5">
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

      <div className="lg:grid lg:grid-cols-[230px_1fr] lg:gap-5">
        {/* 모바일: 가로 스크롤 번호 칩 */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 lg:hidden">
          {prep.stages.map((s, i) => (
            <button
              key={s.stage}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-body-sm transition-colors",
                i === active
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn("tabular-nums", i === active ? "opacity-80" : "opacity-60")}>
                {i + 1}
              </span>
              {s.label}
            </button>
          ))}
        </div>

        {/* 데스크톱: 세로 스텝퍼 — 번호 원 + 단계 사이 연결선으로 순서를 표현 */}
        <ol className="hidden lg:block">
          {prep.stages.map((s, i) => (
            <li key={s.stage} className="relative">
              {i < prep.stages.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[13px] top-9 w-px bg-border"
                />
              )}
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                className="group flex w-full items-center gap-3 py-1.5 text-left"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-caption font-semibold tabular-nums transition-colors",
                    i === active
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground group-hover:border-primary/40 group-hover:text-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span
                  className={cn(
                    "text-body-sm transition-colors",
                    i === active
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {s.label}
                </span>
              </button>
            </li>
          ))}
        </ol>

        {/* 선택 단계 콘텐츠 */}
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
      </div>

      {/* 하단 카드 2장 — 단골 주제(카테고리 뱃지) + 역질문 */}
      {(prep.stack_specific_topics.length > 0 || prep.questions_to_ask_them.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {prep.stack_specific_topics.length > 0 && (
            <div className="rounded-md border border-border bg-card p-4">
              <h3 className="text-body-sm font-medium">이 공고 스택 단골 주제</h3>
              <ul className="mt-2.5 space-y-2">
                {prep.stack_specific_topics.map((t) => {
                  const { category, body } = splitTopic(t);
                  return (
                    <li key={t} className="flex items-start gap-2 text-body-sm">
                      {category && (
                        <Badge variant="outline" className="shrink-0">
                          {category}
                        </Badge>
                      )}
                      <span className="text-muted-foreground">{body}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {prep.questions_to_ask_them.length > 0 && (
            <div className="rounded-md border border-border bg-card p-4">
              <h3 className="text-body-sm font-medium">역질문 (면접관에게)</h3>
              <ul className="mt-2.5 space-y-1.5 text-body-sm text-muted-foreground">
                {prep.questions_to_ask_them.map((q, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden="true">·</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{prep.note}</p>
    </section>
  );
}
