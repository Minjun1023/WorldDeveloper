import { Briefcase, MapPin, TrendingUp } from "lucide-react";
import type { ComponentType } from "react";

import { compactLocation } from "@/lib/jobLocation";
import { formatSalary } from "@/lib/salary";
import type { JobDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMP_LABEL: Record<string, string> = {
  FULLTIME: "정규직", PARTTIME: "파트타임", CONTRACTOR: "계약직", TEMPORARY: "임시직", INTERN: "인턴",
};
const SENIORITY_KO: Record<string, string> = {
  Principal: "프린시플", Staff: "스태프", Lead: "리드", Senior: "시니어", Junior: "주니어", Intern: "인턴", Entry: "신입",
};
const VISA_LABEL: Record<string, string> = { sponsors: "지원 가능", no_sponsor: "스폰서 불가" };

function experienceText(years?: number | null, seniority?: string | null): string {
  if (seniority === "Entry" || years === 0) return "신입";
  const level = seniority ? (SENIORITY_KO[seniority] ?? seniority) : null;
  const yrs = years != null ? `${years}년+` : null;
  return [level, yrs].filter(Boolean).join(" · ") || "미표기";
}

type Chip = {
  icon?: ComponentType<{ className?: string }>;
  text: string;
  tone?: "visa" | "salary";
};

// 핵심 정보(비자·위치·경력·고용형태·연봉)를 제목 바로 아래 '한눈에' 인라인 칩으로 보여준다.
// 위치는 compactLocation 으로 압축(한 줄). 비자=초록, 연봉=파랑 강조로 시선을 잡는다.
export function JobFactCards({ job }: { job: JobDetail }) {
  const visaText = job.visa?.status ? (VISA_LABEL[job.visa.status] ?? "정보 불충분") : "정보 불충분";
  const isSponsor = job.visa?.status === "sponsors";
  const salaryText = formatSalary(job.salary); // 급여 명시 시에만 칩 추가(미명시면 생략).

  const chips: Chip[] = [
    { text: `비자 ${visaText}`, tone: isSponsor ? "visa" : undefined },
    { icon: MapPin, text: compactLocation(job) || "위치 미표기" },
    { icon: TrendingUp, text: experienceText(job.experience_years, job.seniority) },
    { icon: Briefcase, text: job.employment_type ? (EMP_LABEL[job.employment_type] ?? job.employment_type) : "고용형태 미표기" },
    ...(salaryText ? [{ text: salaryText, tone: "salary" as const }] : []),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <span
          key={c.text}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-body-sm font-semibold",
            c.tone === "visa" && "border-success/30 bg-success/5 text-success",
            c.tone === "salary" && "border-primary/25 bg-primary/5 text-primary",
            !c.tone && "border-border bg-surface text-foreground",
          )}
        >
          {c.icon && (
            <c.icon
              className={cn(
                "h-4 w-4 shrink-0",
                c.tone === "visa" ? "text-success" : c.tone === "salary" ? "text-primary" : "text-muted-foreground",
              )}
            />
          )}
          {c.text}
        </span>
      ))}
    </div>
  );
}
