import { Badge } from "@/components/ui/badge";
import type { RemoteEligibility } from "@/lib/types";

// VisaBadge 와 동일 철학: 신호가 되는 값만 표시. region_restricted/unclear/onsite(null)는
// 배지를 렌더링하지 않는다(한국 거주자가 지원 가능한 worldwide/apac_ok 만 양성 신호).
const LABEL: Partial<Record<RemoteEligibility, string>> = {
  worldwide: "원격 가능",
  apac_ok: "아시아 원격",
};

export function RemoteBadge({ eligibility }: { eligibility?: RemoteEligibility | null }) {
  if (eligibility !== "worldwide" && eligibility !== "apac_ok") return null;

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
