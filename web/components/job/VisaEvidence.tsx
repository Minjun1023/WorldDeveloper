import { Check } from "lucide-react";
import type { JobVisa } from "@/lib/types";

export function VisaEvidence({ visa }: { visa?: JobVisa }) {
  const evidence = visa?.evidence ?? [];
  if (evidence.length === 0 && !visa?.register_verified) return null;
  return (
    <div className="rounded-xl border border-success/30 bg-success/5 p-3">
      {visa?.register_verified && (
        <span className="mb-2 inline-block rounded-full bg-success/15 px-2 py-0.5 text-caption font-semibold text-success">명부검증</span>
      )}
      <ul className="space-y-1.5">
        {evidence.map((e, i) => (
          <li key={i} className="flex items-start gap-1.5 text-body-sm text-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <span>{e}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
