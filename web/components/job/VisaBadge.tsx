import { Badge } from "@/components/ui/badge";
import type { VisaStatus } from "@/lib/types";

const LABEL: Record<VisaStatus, string> = {
  sponsors: "스폰서 가능",
  no_sponsor: "스폰서 불가",
  unclear: "정보 없음",
};

// success/destructive 는 12% tint 배경 (web/DESIGN.md VisaBadge 사양)
const TINT: Partial<Record<VisaStatus, string>> = {
  sponsors: "color-mix(in srgb, var(--success) 12%, transparent)",
  no_sponsor: "color-mix(in srgb, var(--destructive) 12%, transparent)",
};

export function VisaBadge({ status }: { status?: VisaStatus }) {
  const s = status ?? "unclear";
  const variant = s === "sponsors" ? "success" : s === "no_sponsor" ? "destructive" : "muted";
  const style = TINT[s] ? { backgroundColor: TINT[s] } : undefined;

  return (
    <Badge variant={variant} style={style} className="shrink-0">
      {LABEL[s]}
    </Badge>
  );
}
