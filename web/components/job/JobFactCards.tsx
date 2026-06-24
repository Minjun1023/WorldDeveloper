import { flagFromLocation } from "@/lib/flags";
import { deadlineLabel } from "@/lib/jobDates";
import { compactLocation } from "@/lib/jobLocation";
import { employmentLabel, levelText } from "@/lib/jobMeta";
import { formatSalary, formatSalaryKrw } from "@/lib/salary";
import type { JobDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = { label: string; value: string; tone?: "salary"; sub?: string };

// 핵심 정보(근무지·경력·고용형태·연봉·마감)를 라벨-값 그리드로 표시. 칩 한 줄 대신 표 형태라
// 정렬이 깔끔하고 스캔하기 쉽다. 연봉=파랑. 비자는 뷰어블 게이트로 노출 공고가 전부 지원
// 가능이라 행을 생략한다(사이드바가 상세 비자 정보를 담당).
export function JobFactCards({ job }: { job: JobDetail }) {
  const salaryText = formatSalary(job.salary);
  const salaryKrw = formatSalaryKrw(job.salary);
  const flag = flagFromLocation(job.location);
  const locText = compactLocation(job) || "위치 미표기";
  const level = levelText(job.experience_years, job.seniority);
  const deadline = deadlineLabel(job.closes_at);

  const rows: Row[] = [
    { label: "근무지", value: flag ? `${locText} ${flag}` : locText },
    ...(level ? [{ label: "경력", value: level }] : []),
    { label: "고용형태", value: employmentLabel(job.employment_type) },
    {
      label: "연봉",
      value: salaryKrw ?? salaryText ?? "비공개",
      tone: salaryText ? "salary" : undefined,
      sub: salaryKrw && salaryText ? salaryText : undefined,
    },
    { label: "마감", value: deadline.text },
  ];

  return (
    <dl className="divide-y divide-border border-t border-border">
      {rows.map((r) => (
        <div
          key={r.label}
          className="grid grid-cols-[4.5rem_1fr] items-baseline gap-x-4 py-2.5 sm:grid-cols-[5.5rem_1fr]"
        >
          <dt className="text-body-sm font-medium text-muted-foreground">{r.label}</dt>
          <dd className={cn("text-body-sm font-semibold text-foreground", r.tone === "salary" && "text-primary")}>
            {r.value}
            {r.sub && <span className="ml-1.5 font-normal text-caption text-muted-foreground">{r.sub}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
