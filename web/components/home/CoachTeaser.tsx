import { Briefcase, FileText, Sparkles } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// AI 이력서 코치 티저 — 핵심 기능인데 랜딩에 없던 섹션. 예시 대화 목업(정적)으로
// "공고를 붙이면 그 공고 기준으로 봐준다"를 보여준다. MatchAxes(좌 카피/우 카드)와
// 미러 배치(좌 카드/우 카피)로 리듬을 만든다.
export function CoachTeaser() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      {/* 좌: 예시 대화 목업 */}
      <div className="order-2 flex justify-center lg:order-1">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-md sm:p-6">
          <p className="text-caption text-muted-foreground">예시 대화</p>
          {/* 첨부 칩 — 공고·이력서를 붙였다는 맥락 */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-caption font-medium text-primary">
              <Briefcase className="h-3 w-3" aria-hidden="true" />
              Backend Engineer · Berlin
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-caption font-medium text-primary">
              <FileText className="h-3 w-3" aria-hidden="true" />
              이력서 첨부됨
            </span>
          </div>
          {/* 사용자 말풍선 */}
          <div className="mt-4 flex justify-end">
            <span className="inline-block max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-body-sm text-primary-foreground">
              이 공고 기준으로 제 이력서를 평가해주세요.
            </span>
          </div>
          {/* 코치 말풍선 */}
          <div className="mt-3 flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="inline-block max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-body-sm text-foreground">
              핵심 경험은 공고와 잘 맞아요. 두 가지만 보완하면 좋겠어요 — ① 쿠버네티스 운영 경험을
              상단으로 올리고 ② 결제 도메인 성과를 수치로 적어 주세요.
            </span>
          </div>
        </div>
      </div>

      {/* 우: 카피 + CTA */}
      <div className="order-1 lg:order-2">
        <h2 className="text-h1">
          공고에 맞춰
          <br />
          이력서를 봐주는 AI 코치.
        </h2>
        <p className="mt-4 max-w-md text-body-lg text-muted-foreground">
          저장한 공고를 붙이면 그 공고 기준으로 강점과 보완점을 짚어줘요. 붙여넣은 공고·이력서만
          보고 답하고, 이력서는 저장되지 않아요.
        </p>
        <Link href="/coach" className={cn(buttonVariants({ size: "lg" }), "mt-8")}>
          이력서 코치 시작하기
        </Link>
      </div>
    </div>
  );
}
