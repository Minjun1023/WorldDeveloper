// SponsorMap 의 "HOME OFFICE REGISTER" 권위 pill 을 본 프로젝트의 실제 차별점
// (UK 내무부 명부 + US USCIS 데이터 대조)으로 번안. 정적 카피, 데이터 의존 없음.
// 주의: "매일 갱신" 류 갱신 주기 문구는 넣지 않는다 — 로컬 위주이고 ETL 자동 스케줄러가
// 꺼져 있어(ETL_ENABLED=false) 현재 사실이 아님. 배포+스케줄러 가동(일 1회) 시 재검토.
export function CredibilityPill() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-semibold text-verified"
      style={{ backgroundColor: "color-mix(in srgb, var(--verified) 12%, transparent)" }}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2 4 5v6c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V5l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      UK 내무부 명부 · US USCIS 대조
    </span>
  );
}
