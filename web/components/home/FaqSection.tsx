const FAQS = [
  {
    q: "'명부 검증 스폰서'가 무슨 뜻인가요?",
    a: "영국 내무부(Home Office) 라이선스 스폰서 명부와 미국 USCIS 고용주 데이터에 등재된 회사를 대조해, 실제로 비자 스폰서가 가능한 회사를 표시합니다.",
  },
  {
    q: "비자 스폰서십 공고는 어떻게 확인하나요?",
    a: "공고의 비자 정책을 분석해 '스폰서 가능/불가'로 분류하고, 정보가 불명확하면 추측하지 않고 숨깁니다. 명부 대조로 확인된 회사는 별도 신호로 표시됩니다.",
  },
  {
    q: "이주 트랙과 원격 트랙은 어떻게 다른가요?",
    a: "이주 트랙은 비자 스폰서를 받아 현지에서 근무하는 공고, 원격 트랙은 한국에 거주하면서 지원 가능한 원격 공고입니다. 상단에서 원하는 트랙을 고를 수 있습니다.",
  },
  {
    q: "무료인가요?",
    a: "네. 검색과 추천 모두 무료이며 회원가입 없이 사용할 수 있습니다.",
  },
  {
    q: "공고는 얼마나 자주 갱신되나요?",
    a: "여러 채용 소스와 정부 명부를 정기적으로 수집·대조해 갱신합니다.",
  },
];

export function FaqSection() {
  return (
    <div className="mx-auto max-w-2xl divide-y divide-border rounded-lg border border-border bg-surface">
      {FAQS.map((f) => (
        <details key={f.q} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-foreground">
            {f.q}
            <span className="ml-3 text-muted-foreground transition-transform group-open:rotate-45" aria-hidden="true">
              +
            </span>
          </summary>
          <p className="mt-2 text-body-sm leading-relaxed text-muted-foreground">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
