import { Badge } from "@/components/ui/badge";
import type { VisaStatus } from "@/lib/types";

// "스폰서 가능"(sponsors)은 배지를 표시하지 않는다 — 사이트가 사실상 스폰서 가능 공고 위주라
// 중복 신호이기 때문. (명부 검증은 별도 RegisterVerifiedBadge)
// unclear 는 "검사했으나 본문에 비자 언급이 없음 = 모름"이라, 침묵 대신 정직한 중립 라벨로
// 표시한다(직접 확인 안내 툴팁). sponsors 로 추정하지 않는다("추정 금지·정확도 우선").
// "스폰서 불가"(no_sponsor)는 부정 신호라 경고로 남긴다.
export function VisaBadge({ status }: { status?: VisaStatus }) {
  if (status === "unclear") {
    return (
      <Badge
        variant="muted"
        className="shrink-0"
        title="이 공고 본문에는 비자 스폰서십 언급이 없어요. 회사에 직접 확인해 보세요."
      >
        비자 정보 없음
      </Badge>
    );
  }

  if (status === "no_sponsor") {
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

  return null;
}
