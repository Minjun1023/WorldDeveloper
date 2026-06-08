import { ShieldCheck } from "lucide-react";

// 정부 공식 명부(UK Home Office 라이선스 / US USCIS H-1B) 대조로 확인된 스폰서에만 표시하는
// 신뢰 마커. 키워드/추론 스폰서(초록 "스폰서 가능")와 구분되는 최상위 신호.
// register_verified 가 true 일 때만 렌더(아니면 호출부에서 렌더하지 않는다).
// 스타일: amber 그라데이션 칩 + 방패-체크 아이콘(readdy 레퍼런스 카드와 동일).
export function RegisterVerifiedBadge() {
  return (
    <span
      title="정부 공식 스폰서 명부(UK Home Office / US USCIS)에서 확인된 회사"
      aria-label="정부 명부 검증 스폰서"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-amber-100 to-amber-50 p-1 text-amber-800 ring-1 ring-amber-300 dark:from-amber-500/15 dark:to-amber-500/5 dark:text-amber-300 dark:ring-amber-500/30"
    >
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}
