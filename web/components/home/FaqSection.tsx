// 카피는 실데이터/실동작에 맞춰 정직하게: 추천·코치는 무료 회원 전용, 코치는 영구저장 안 함,
// 명부 검증은 UK 내무부·US USCIS·NL IND 대조. 갱신 주기 단정은 피한다(스케줄러 상시가동 아님).
const FAQS = [
  {
    q: "비자 스폰서십 공고는 어떻게 구분하나요?",
    a: "각 공고 원문을 영어·독일어·네덜란드어·일본어 등 패턴으로 분석해, 스폰서십 관련 문장이 명시된 경우에만 “비자 가능”으로 분류합니다. 단순 토글이 아니라 매칭된 원문 문장을 근거로 함께 보여드려요. 정부 명부(UK 내무부·US USCIS·NL IND)와 대조해 확인된 회사는 “명부 검증”으로 별도 표시합니다.",
  },
  {
    q: "6차원 점수는 어떤 기준으로 계산되나요?",
    a: "스택·비자·지역·레벨·연봉·의미 6개 축을 각각 0~100으로 계산해 합산합니다. 보유 기술과 공고 키워드 일치도, 비자 스폰서 여부, 희망 지역·레벨 부합, 연봉 적합도, 직무 설명과의 의미적 유사도를 반영해요. 로그인 후 프로필을 작성하면 내 기준으로 점수가 계산됩니다.",
  },
  {
    q: "deal-breaker 표시는 무엇을 뜻하나요?",
    a: "지원 자체가 사실상 막히는 결격 요인(예: 비자 스폰서 불가, 특정 지역 거주자만 지원 가능)을 뜻합니다. deal-breaker가 있으면 점수가 높아도 상단에 경고로 보여줘 헛걸음을 줄여드려요.",
  },
  {
    q: "WorldDeveloper는 유료인가요?",
    a: "검색·회사 디렉터리·공고 열람은 무료이며 회원가입 없이 이용할 수 있어요. 내 프로필 기반 맞춤 추천과 이력서 코치는 무료 회원가입 후 이용할 수 있습니다.",
  },
  {
    q: "이력서나 프로필 정보는 안전한가요?",
    a: "맞춤 추천은 가입 시 입력한 프로필(기술 스택·희망 지역 등)을 기준으로 계산합니다. 대화형 이력서 코치는 상담 맥락에만 사용하며, 대화 기록이나 이력서를 영구 저장하지 않아요.",
  },
];

export function FaqSection() {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-border border-y border-border">
      {FAQS.map((f, i) => (
        <details key={f.q} className="group" open={i === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-body font-semibold text-foreground">
            {f.q}
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-180 group-open:border-primary/40 group-open:text-primary"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </summary>
          <p className="-mt-1 pb-5 pr-10 text-body-sm leading-relaxed text-muted-foreground">
            {f.a}
          </p>
        </details>
      ))}
    </div>
  );
}
