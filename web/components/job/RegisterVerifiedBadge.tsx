import { Badge } from "@/components/ui/badge";

// 정부 공식 명부(UK Home Office 라이선스 / US USCIS H-1B) 대조로 확인된 스폰서에만 표시하는
// 골드 신뢰 마커. 키워드/추론 스폰서(초록 "스폰서 가능")와 구분되는 최상위 신호.
// register_verified 가 true 일 때만 렌더(아니면 호출부에서 렌더하지 않는다).
export function RegisterVerifiedBadge() {
  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1 border-verified/30 text-verified"
      style={{ backgroundColor: "color-mix(in srgb, var(--verified) 14%, transparent)" }}
      title="정부 공식 스폰서 명부(UK Home Office / US USCIS)에서 확인된 회사"
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
        <path d="M6.5 11.5 3 8l1.1-1.1 2.4 2.4 5-5L12.6 5.4z" />
      </svg>
      명부 검증
    </Badge>
  );
}
