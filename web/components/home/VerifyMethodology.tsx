import { BadgeCheck, FileText, Shield } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// "어떻게 검증하나요?" — 이 서비스의 차별점인 비자 검증 3단계를 설명하고
// 국가별 상세(비자 종류·요건·절차)는 비자 가이드(/visa)로 안내한다. 문구는 실제 동작에 맞춰 정직하게.
const STEPS: {
  step: string;
  title: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
}[] = [
  {
    step: "01",
    title: "정부 명부 교차검증",
    desc: "미국 USCIS, 영국 Home Office, 네덜란드 IND 등 각국 정부의 공식 비자 스폰서 명부와 기업명을 매일 자동 교차검증합니다.",
    icon: Shield,
    color: "#4338ca",
  },
  {
    step: "02",
    title: "공고 원문 분류",
    desc: "채용 공고 원문에서 비자 스폰서십 관련 문구를 추출·분류합니다. 모호한 표현은 ‘불충분’으로 표기하며 절대 추측하지 않습니다.",
    icon: FileText,
    color: "#2b6cf0",
  },
  {
    step: "03",
    title: "검증 배지·정직한 표기",
    desc: "정부 명부까지 통과한 공고에만 ‘비자 검증’ 배지가 붙습니다. 명부에 없거나 문구가 불명확하면 추측 대신 ‘정보 없음’으로 표기하고 기본 검색에서 제외합니다.",
    icon: BadgeCheck,
    color: "#0d9488",
  },
];

export function VerifyMethodology() {
  return (
    <div>
      <div className="grid gap-5 md:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.step} className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              {/* 배경은 액센트색 10% 알파 — 하드코딩 파스텔(bg)과 달리 다크모드에서도 자연스럽다. */}
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${s.color}1a`, color: s.color }}
              >
                <s.icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              {/* 워터마크 숫자는 border 토큰 — 라이트/다크 모두 은은한 회색으로 자동 전환. */}
              <span className="text-3xl font-extrabold leading-none tabular-nums text-border">
                {s.step}
              </span>
            </div>
            <h3 className="mt-4 text-body font-bold text-foreground">{s.title}</h3>
            <p className="mt-2 text-body-sm leading-relaxed text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* 국가별 비자 종류·요건·절차 상세는 비자 가이드가 담당 */}
      <div className="mt-8 text-center">
        <Link href="/visa" className={cn(buttonVariants({ size: "lg" }))}>
          비자 가이드 자세히 보기
        </Link>
        <p className="mt-2 text-caption text-muted-foreground">
          국가별 비자 종류·요건·절차를 한글로 정리했어요.
        </p>
      </div>
    </div>
  );
}
