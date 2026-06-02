import { Badge } from "@/components/ui/badge";
import type { VisaStatus } from "@/lib/types";

// "스폰서 가능"(sponsors) 배지는 표시하지 않는다 — 사이트가 사실상 스폰서 가능 공고 위주라
// 중복 신호이기 때문. unclear("정보 없음")도 미표시(대다수가 비자 정책 미명시). 부정 신호인
// "스폰서 불가"(no_sponsor)만 경고로 남긴다. (명부 검증 신호는 별도 RegisterVerifiedBadge)
export function VisaBadge({ status }: { status?: VisaStatus }) {
  if (status !== "no_sponsor") return null;

  return (
    <Badge
      variant="destructive"
      style={{ backgroundColor: "color-mix(in srgb, var(--destructive) 12%, transparent)" }}
      className="shrink-0"
    >
      스폰서 불가
    </Badge>
  );
}
