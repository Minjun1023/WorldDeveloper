import { FileCheck2, Info, ShieldCheck } from "lucide-react";

import { TIER_LABEL, TIER_NOTE, visaEvidenceTier } from "@/lib/visa-evidence";
import type { JobVisa } from "@/lib/types";
import { cn } from "@/lib/utils";

// 상세 페이지의 "비자 스폰서십 근거" 블록 — sponsors 판정의 실제 근거 문장과 신뢰 등급을 투명하게 공개.
// 간접 근거(회사 이력 기반)일수록 눈에 띄는 캐비앳을 달아 오해를 막는다.
export function VisaEvidenceNote({ visa }: { visa?: JobVisa | null }) {
  const tier = visaEvidenceTier(visa);
  if (!tier) return null;
  const evidence = visa?.evidence ?? [];

  const Icon = tier === "register" ? ShieldCheck : tier === "direct" ? FileCheck2 : Info;

  return (
    <section
      className={cn(
        "rounded-xl border p-4",
        tier === "indirect" ? "border-warning/30 bg-warning/5" : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn("h-4 w-4 shrink-0", tier === "register" ? "text-verified" : tier === "direct" ? "text-primary" : "text-warning")}
          aria-hidden="true"
        />
        <h2 className="text-body-sm font-semibold text-foreground">
          비자 스폰서십 근거 — {TIER_LABEL[tier]}
        </h2>
      </div>
      {evidence.length > 0 && (
        <ul className="mt-2 space-y-1">
          {evidence.map((e) => (
            <li key={e} className="text-body-sm text-muted-foreground">
              · {e}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-caption text-muted-foreground">{TIER_NOTE[tier]}</p>
    </section>
  );
}
