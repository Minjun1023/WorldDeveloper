import { ScanText, ShieldCheck, Sparkles } from "lucide-react";

// "어떻게 검증을 신뢰할 수 있나요?" 방법론 3단계. 문구는 실제 동작에 맞춰 정직하게.
// (정부 명부 대조 → 공고 원문 분류 → 6차원 점수) — 임의 분류 없이 출처/근거를 보여준다.
const STEPS = [
  {
    n: "01",
    icon: ShieldCheck,
    title: "정부 명부 교차 검증",
    desc: "미국 USCIS H-1B 고용주 명부, 영국 Home Office 스폰서 명부, 네덜란드 IND 인정 스폰서 명부와 회사명을 대조해, 확인된 회사를 ‘명부 검증’으로 표시해요.",
  },
  {
    n: "02",
    icon: ScanText,
    title: "공고 원문 분류",
    desc: "공고 원문을 영어·일본어·독일어·네덜란드어 등 언어 패턴으로 분석해, 스폰서십이 명시된 문장만 추출해요. 단순 토글이 아니라 매칭된 원문 문장을 근거로 함께 보여드려요.",
  },
  {
    n: "03",
    icon: Sparkles,
    title: "6차원 점수 계산",
    desc: "스택·비자·지역·레벨·연봉·의미 6개 축을 0~100으로 계산해, 내 프로필에 맞는 공고를 정렬해드려요.",
  },
];

export function VerifyMethodology() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {STEPS.map((s) => (
        <div key={s.n} className="flex flex-col rounded-lg border border-border bg-surface p-6">
          <div className="flex items-center justify-between">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl text-primary"
              style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
            >
              <s.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="font-mono text-caption font-semibold tracking-wide text-muted-foreground">
              STEP {s.n}
            </span>
          </div>
          <h3 className="mt-4 text-body font-bold text-foreground">{s.title}</h3>
          <p className="mt-2 text-body-sm leading-relaxed text-muted-foreground">{s.desc}</p>
        </div>
      ))}
    </div>
  );
}
