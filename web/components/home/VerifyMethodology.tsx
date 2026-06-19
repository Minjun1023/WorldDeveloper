import { BarChart3, FileText, Shield } from "lucide-react";
import type { ComponentType } from "react";

// "어떻게 검증하나요?" 3단계 교차검증. 문구는 실제 동작에 맞춰 정직하게.
const STEPS: {
  step: string;
  title: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}[] = [
  {
    step: "01",
    title: "정부 명부 교차검증",
    desc: "미국 USCIS, 영국 Home Office, 네덜란드 IND 등 각국 정부의 공식 비자 스폰서 명부와 기업명을 매일 자동 교차검증합니다.",
    icon: Shield,
    color: "#4338ca",
    bg: "#eef2ff",
  },
  {
    step: "02",
    title: "공고 원문 분류",
    desc: "채용 공고 원문에서 비자 스폰서십 관련 문구를 추출·분류합니다. 모호한 표현은 ‘불충분’으로 표기하며 절대 추측하지 않습니다.",
    icon: FileText,
    color: "#2b6cf0",
    bg: "#eef3fe",
  },
  {
    step: "03",
    title: "6차원 점수 산출",
    desc: "스택·비자·지역·레벨·연봉·의미 6개 축으로 프로필과 공고의 매칭 점수를 계산합니다. 각 근거는 투명하게 공개됩니다.",
    icon: BarChart3,
    color: "#0d9488",
    bg: "#f0fdfa",
  },
];

export function VerifyMethodology() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {STEPS.map((s) => (
        <div key={s.step} className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: s.bg, color: s.color }}
            >
              <s.icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="text-3xl font-extrabold leading-none tabular-nums text-[#e5e7eb] dark:text-[#2d3748]">
              {s.step}
            </span>
          </div>
          <h3 className="mt-4 text-body font-bold text-foreground">{s.title}</h3>
          <p className="mt-2 text-body-sm leading-relaxed text-muted-foreground">{s.desc}</p>
        </div>
      ))}
    </div>
  );
}
