import { Badge } from "@/components/ui/badge";
import type { VisaStatus } from "@/lib/types";

const LABEL: Partial<Record<VisaStatus, string>> = {
  sponsors: "스폰서 가능",
  no_sponsor: "스폰서 불가",
};

// success/destructive 는 12% tint 배경 (web/DESIGN.md VisaBadge 사양)
const TINT: Partial<Record<VisaStatus, string>> = {
  sponsors: "color-mix(in srgb, var(--success) 12%, transparent)",
  no_sponsor: "color-mix(in srgb, var(--destructive) 12%, transparent)",
};

// unclear("정보 없음")는 배지를 렌더링하지 않는다. 대다수 공고가 비자 정책을 명시하지
// 않아(active 공고의 ~84%) 회색 "정보 없음" 배지가 카드 화면을 뒤덮기 때문. 스폰서
// 가능/불가만 신호로 표시한다.
export function VisaBadge({ status }: { status?: VisaStatus }) {
  if (status !== "sponsors" && status !== "no_sponsor") return null;
  const variant = status === "sponsors" ? "success" : "destructive";

  return (
    <Badge variant={variant} style={{ backgroundColor: TINT[status] }} className="shrink-0">
      {LABEL[status]}
    </Badge>
  );
}
