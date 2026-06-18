import { Briefcase, MapPin, TrendingUp } from "lucide-react";
import type { ComponentType } from "react";

import { compactLocation } from "@/lib/jobLocation";
import { formatSalary } from "@/lib/salary";
import type { JobDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

// 키는 정규화형(대문자·영문자만). 소스마다 "Full-time"/"FULL_TIME"/"fulltime" 등 표기가 달라
// employmentLabel 에서 비영문자를 제거해 매칭한다.
const EMP_LABEL: Record<string, string> = {
  FULLTIME: "정규직",
  PARTTIME: "파트타임",
  CONTRACT: "계약직", CONTRACTOR: "계약직", CONTRACTTOHIRE: "계약직",
  TEMPORARY: "임시직", TEMP: "임시직",
  INTERN: "인턴", INTERNSHIP: "인턴",
  FREELANCE: "프리랜서",
};

// 고용형태 라벨 — 표기 차이를 흡수(영문자만 남겨 대문자 매칭). 미매칭이면 원문 유지.
function employmentLabel(raw?: string | null): string {
  if (!raw) return "고용형태 미표기";
  return EMP_LABEL[raw.toUpperCase().replace(/[^A-Z]/g, "")] ?? raw;
}
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
  flex?: boolean; // 공간 부족 시 줄어들며 말줄임(긴 위치 칩 전용) — 나머지는 고정.
};

// 핵심 정보(비자·위치·경력·고용형태·연봉)를 제목 바로 아래 '한눈에' 인라인 칩으로 보여준다.
// 위치는 compactLocation 으로 압축(한 줄). 비자=초록, 연봉=파랑 강조로 시선을 잡는다.
export function JobFactCards({ job }: { job: JobDetail }) {
  const visaText = job.visa?.status ? (VISA_LABEL[job.visa.status] ?? "정보 불충분") : "정보 불충분";
  const isSponsor = job.visa?.status === "sponsors";
  const salaryText = formatSalary(job.salary); // 급여 명시 시에만 칩 추가(미명시면 생략).

  const chips: Chip[] = [
    { text: `비자 ${visaText}`, tone: isSponsor ? "visa" : undefined },
    { icon: MapPin, text: compactLocation(job) || "위치 미표기", flex: true },
    { icon: TrendingUp, text: experienceText(job.experience_years, job.seniority) },
    { icon: Briefcase, text: employmentLabel(job.employment_type) },
    ...(salaryText ? [{ text: salaryText, tone: "salary" as const }] : []),
  ];

  return (
    // 한 줄 고정(flex-nowrap): 공간이 부족하면 긴 위치 칩만 말줄임되고, 나머지 칩은 그대로 보인다.
    <div className="flex flex-nowrap gap-2 overflow-hidden">
      {chips.map((c) => (
        <span
          key={c.text}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-body-sm font-semibold",
            c.flex ? "min-w-0" : "shrink-0 whitespace-nowrap",
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
          {c.flex ? <span className="truncate">{c.text}</span> : c.text}
        </span>
      ))}
    </div>
  );
}
