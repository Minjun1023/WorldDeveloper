import { Briefcase, MapPin } from "lucide-react";
import type { ComponentType } from "react";

import { flagFromLocation } from "@/lib/flags";
import { compactLocation } from "@/lib/jobLocation";
import { employmentLabel, levelText } from "@/lib/jobMeta";
import { formatSalary } from "@/lib/salary";
import type { JobDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

type Chip = {
  icon?: ComponentType<{ className?: string }>;
  text: string;
  tone?: "salary";
  flex?: boolean; // 공간 부족 시 줄어들며 말줄임(긴 위치 칩 전용) — 나머지는 고정.
};

// 핵심 정보(위치·레벨·고용형태·연봉)를 제목 아래 pill 칩으로 한 줄에. (Figma 상세 헤더)
// 연봉=파랑, 위치=국기 동반, 길면 위치만 말줄임. 비자는 뷰어블 게이트로 노출 공고가 전부
// 지원 가능이라 칩을 생략한다.
export function JobFactCards({ job }: { job: JobDetail }) {
  const salaryText = formatSalary(job.salary);
  const flag = flagFromLocation(job.location);
  const locText = compactLocation(job) || "위치 미표기";
  const level = levelText(job.experience_years, job.seniority);

  const chips: Chip[] = [
    { icon: MapPin, text: flag ? `${locText} ${flag}` : locText, flex: true },
    ...(level ? [{ icon: Briefcase, text: level }] : []),
    { text: employmentLabel(job.employment_type) },
    ...(salaryText ? [{ text: salaryText, tone: "salary" as const }] : []),
  ];

  return (
    // 한 줄 고정(flex-nowrap): 공간이 부족하면 긴 위치 칩만 말줄임되고, 나머지 칩은 그대로 보인다.
    <div className="flex flex-nowrap gap-2 overflow-hidden">
      {chips.map((c) => (
        <span
          key={c.text}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-body-sm font-semibold",
            c.flex ? "min-w-0" : "shrink-0 whitespace-nowrap",
            c.tone === "salary" && "border-primary/30 bg-primary/5 text-primary",
            !c.tone && "border-border bg-surface-2 text-foreground",
          )}
        >
          {c.icon && <c.icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
          {c.flex ? <span className="truncate">{c.text}</span> : c.text}
        </span>
      ))}
    </div>
  );
}
