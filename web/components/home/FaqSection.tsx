// 카피는 실데이터/실동작에 맞춰 정직하게: 5축 가중치는 실제 엔진이 스택 비중을 더 크게 두므로
// 특정 퍼센트를 단정하지 않는다. 비자 스폰서십은 매칭 축이 아니라 기본 필터(모든 공고가 충족).
// 명부 검증은 US USCIS · UK Home Office · NL IND 대조.
const FAQS = [
  {
    q: "정부 명부 검증이란 무엇인가요?",
    a: "미국 USCIS Employer Data Hub, 영국 Home Office Sponsor Register, 네덜란드 IND Recognised Sponsor Register 등 각국 정부의 공식 비자 스폰서 명부와 교차검증하여, 실제 스폰서십 이력이 확인된 기업만을 ‘명부 검증’으로 표시합니다.",
  },
  {
    q: "비자 스폰서십 명시와 정부 명부 검증의 차이는?",
    a: "비자 스폰서십 명시는 채용 공고 원문에 스폰서십 지원 의사가 적혀 있는 경우입니다. 정부 명부 검증은 한 단계 더 나아가 실제 정부 데이터베이스에서 해당 기업의 스폰서 이력을 직접 확인한 경우로, 더 높은 신뢰도를 의미합니다.",
  },
  {
    q: "5축 매칭 점수는 어떻게 계산하나요?",
    a: "스택·지역·레벨·연봉·의미 5개 축의 가중 평균으로 계산합니다. 보유 기술과 공고 키워드 일치도(스택), 희망 지역 부합, 레벨·시니어리티, 연봉 적합도, 직무 설명과의 의미적 유사도를 반영합니다. 비자 스폰서십은 매칭 축이 아니라 기본 필터라 모든 공고가 충족하며, 프로필을 작성하면 내 기준으로 정확한 점수를 확인할 수 있습니다.",
  },
  {
    q: "무료로 사용할 수 있나요?",
    a: "공고 검색 및 기본 정보는 무료이며 회원가입 없이 이용할 수 있습니다. 5축 매칭 점수, 맞춤 추천, 공고 관리 칸반 보드는 프로필 작성 후 이용 가능합니다. 현재 모든 기능을 무료로 제공하고 있습니다.",
  },
];

export function FaqSection() {
  return (
    <div className="mx-auto max-w-2xl space-y-2">
      {FAQS.map((f) => (
        <details key={f.q} className="group overflow-hidden rounded-xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-body-sm font-semibold text-foreground transition-colors hover:bg-accent">
            {f.q}
            <span
              className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </summary>
          <div className="section-muted border-t border-border px-4 py-3.5">
            <p className="text-body-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
