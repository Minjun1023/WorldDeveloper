// DevPass 브랜드 마크 — 'D' 이니셜 레터마크 (지구본에서 교체, 2026-07).
// 색은 currentColor: 파랑 박스 안에서는 text-white, 흰 배경에서는 text-primary 로 컨테이너가 결정.
// 파비콘(app/icon.svg·favicon.ico)도 동일 지오메트리를 사용한다 — 수정 시 함께 갱신할 것.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      {/* 기하학적 볼드 D — 스템·볼 두께 3 균일, 오른쪽 반원 볼(r7/내부 r4) */}
      <path
        fillRule="evenodd"
        d="M6 5 H11.5 A7 7 0 0 1 11.5 19 H6 Z M9 8 V16 H11.5 A4 4 0 0 0 11.5 8 Z"
      />
    </svg>
  );
}
