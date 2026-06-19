import { Badge } from "@/components/ui/badge";
import type { RemoteEligibility } from "@/lib/types";

// VisaBadge 와 동일 철학: 신호가 되는 값만 표시. 기본은 한국 거주자가 지원 가능한
// worldwide/apac_ok 만 양성 신호로 노출(검색·추천 등). 회사 페이지처럼 "원격 가능 공고"를
// 모두 표기하고 싶은 곳은 includeRestricted 로 지역 제한 원격도 (정직한 라벨로) 표시한다.
const LABEL: Partial<Record<RemoteEligibility, string>> = {
  worldwide: "원격 가능",
  apac_ok: "아시아 원격",
};

export function RemoteBadge({
  eligibility,
  isRemote = false,
  includeRestricted = false,
}: {
  eligibility?: RemoteEligibility | null;
  isRemote?: boolean;
  includeRestricted?: boolean;
}) {
  // 강신호 — 한국에서 지원 가능한 원격.
  if (eligibility === "worldwide" || eligibility === "apac_ok") {
    return (
      <Badge
        variant="outline"
        className="shrink-0 border-primary/30 text-primary"
        style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}
      >
        {LABEL[eligibility]}
      </Badge>
    );
  }

  // 옵트인 — 원격이지만 지역 제한이 있는 공고. 강신호와 시각적으로 구분(중립 톤)하고
  // "지역 제한"을 명시해 한국 지원 가능으로 오인하지 않게 한다.
  if (includeRestricted && (eligibility === "region_restricted" || isRemote === true)) {
    return (
      <Badge variant="outline" className="shrink-0 border-border text-muted-foreground">
        원격 (지역 제한)
      </Badge>
    );
  }

  return null;
}
