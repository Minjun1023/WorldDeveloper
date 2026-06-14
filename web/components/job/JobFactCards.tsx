import type { JobDetail } from "@/lib/types";

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

export function JobFactCards({ job }: { job: JobDetail }) {
  const visaText = job.visa?.status ? (VISA_LABEL[job.visa.status] ?? "정보 불충분") : "정보 불충분";
  const isSponsor = job.visa?.status === "sponsors";
  const cards = [
    { label: "비자", value: visaText, accent: isSponsor },
    { label: "위치", value: [job.location_ko ?? job.location, job.is_remote ? "원격" : null].filter(Boolean).join(" · ") || "미표기" },
    { label: "경력", value: experienceText(job.experience_years, job.seniority) },
    { label: "고용형태", value: job.employment_type ? (EMP_LABEL[job.employment_type] ?? job.employment_type) : "미표기" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-xl border p-3 ${c.accent ? "border-success/30 bg-success/5" : "border-border bg-surface"}`}>
          <div className="text-caption text-muted-foreground">{c.label}</div>
          <div className={`mt-0.5 text-body-sm font-semibold ${c.accent ? "text-success" : ""}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
