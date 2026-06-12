import { ShieldCheck } from "lucide-react";

// 정부 공식 명부(UK Home Office 라이선스 / US USCIS H-1B / NL IND) 대조로 확인된 스폰서 신뢰 마커.
// register_verified 가 true 일 때만 렌더(아니면 호출부에서 렌더하지 않는다).
// 스타일: 조용한 amber 방패-체크 아이콘만(과거 그라데이션 칩 → 탈AI·노이즈 감소). 활성 공고의 ~45%가
// 검증이라 칩으로 강조하면 변별력이 떨어져 노이즈가 됨. 의미는 title/aria-label(툴팁·스크린리더)로 전달.
export function RegisterVerifiedBadge() {
  return (
    <span
      title="정부 공식 스폰서 명부에서 확인된 회사 (UK Home Office / US USCIS / NL IND)"
      aria-label="정부 명부 검증 스폰서"
      role="img"
      className="inline-flex shrink-0 items-center text-verified"
    >
      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}
