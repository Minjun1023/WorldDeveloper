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

// 비자·위치·경력·고용형태·연봉을 하나의 그리드 패널 안에서 칸으로 나눠 보여준다.
// 위치는 compactLocation 으로 압축해 좁은 칸에서도 한 줄에 들어가게 한다.
export function JobFactCards({ job }: { job: JobDetail }) {
  const visaText = job.visa?.status ? (VISA_LABEL[job.visa.status] ?? "정보 불충분") : "정보 불충분";
  const isSponsor = job.visa?.status === "sponsors";
  const salaryText = formatSalary(job.salary); // 급여 명시 시에만 칸 추가(미명시면 생략).
  const cards = [
    { label: "비자", value: visaText, accent: isSponsor },
    { label: "위치", value: compactLocation(job) || "미표기" },
    { label: "경력", value: experienceText(job.experience_years, job.seniority) },
    { label: "고용형태", value: job.employment_type ? (EMP_LABEL[job.employment_type] ?? job.employment_type) : "미표기" },
    ...(salaryText ? [{ label: "연봉", value: salaryText }] : []),
  ];
  return (
    <div className="rounded-xl border border-border bg-surface p-1.5">
      <div
        className={cn(
          "grid grid-cols-2 gap-1.5",
          cards.length >= 5 ? "sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-4",
        )}
      >
        {cards.map((c) => (
          <div
            key={c.label}
            className={cn(
              "rounded-lg px-3 py-2.5",
              c.accent ? "bg-success/10" : "bg-surface-2",
            )}
          >
            <div className="text-caption text-muted-foreground">{c.label}</div>
            <div className={cn("mt-0.5 text-body-sm font-semibold", c.accent && "text-success")}>
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
