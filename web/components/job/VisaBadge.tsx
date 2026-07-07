import { Badge } from "@/components/ui/badge";
import type { VisaStatus } from "@/lib/types";

// "스폰서 가능"(sponsors)은 배지를 표시하지 않는다 — 사이트가 사실상 스폰서 가능 공고 위주라
// 중복 신호이기 때문. (명부 검증은 별도 RegisterVerifiedBadge)
// unclear 는 "검사했으나 본문에 비자 언급이 없음 = 모름". 단, 한국에서 가능한 원격(remoteViable)
// 공고는 한국에서 일하므로 비자가 애초에 필요 없다 → '비자 정보 없음'(누락처럼 보임) 대신
// '비자 불필요'(해당 없음)로 정직하게 표시한다. 온사이트/지역제한이면 '비자 정보 없음' 유지.
// "스폰서 불가"(no_sponsor)는 부정 신호라 경고로 남긴다.
export function VisaBadge({
  status,
  remoteViable = false,
}: {
  status?: VisaStatus;
  remoteViable?: boolean;
}) {
  if (status === "unclear") {
    if (remoteViable) {
      return (
        <Badge
          variant="secondary"
          className="shrink-0"
          title="한국에서 가능한 원격 근무라 비자 스폰서십이 필요 없어요."
        >
          비자 불필요
        </Badge>
      );
    }
    return (
      <Badge
        variant="secondary"
        className="shrink-0"
        title="이 공고 본문에는 비자 스폰서십 언급이 없어요. 회사에 직접 확인해 보세요."
      >
        비자 정보 없음
      </Badge>
    );
  }

  if (status === "no_sponsor") {
    // 새 Badge 의 destructive 는 솔리드 배경 — 여기는 틴트 배경 + 붉은 텍스트가 의도라 outline 변형으로 표현.
    return (
      <Badge
        variant="outline"
        style={{ backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 12%, transparent)" }}
        className="shrink-0 border-destructive/30 text-destructive"
      >
        스폰서 불가
      </Badge>
    );
  }

  return null;
}
