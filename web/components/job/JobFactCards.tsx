import { flagFromLocation } from "@/lib/flags";
import { deadlineLabel } from "@/lib/jobDates";
import { compactLocation } from "@/lib/jobLocation";
import { employmentLabel, levelText } from "@/lib/jobMeta";
import { formatSalary, formatSalaryKrw } from "@/lib/salary";
import type { JobDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = { label: string; value: string; tone?: "salary" | "positive"; sub?: string };

// 어학 요건 한글 라벨. english_only 는 '현지어 불필요'라는 긍정 신호로 표기.
const LANGUAGE_KO: Record<string, string> = {
  english_only: "영어로 근무 가능 (현지어 불필요)",
  german: "독일어 필수",
  japanese: "일본어 필수",
  french: "프랑스어 필수",
  dutch: "네덜란드어 필수",
  korean: "한국어 필수 (한국인 우대 포지션)",
  spanish: "스페인어 필수",
  portuguese: "포르투갈어 필수",
  italian: "이탈리아어 필수",
  polish: "폴란드어 필수",
  swedish: "스웨덴어 필수",
  chinese: "중국어 필수",
};

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

  const language = job.language_requirement ? LANGUAGE_KO[job.language_requirement] : null;

  const rows: Row[] = [
    { label: "근무지", value: flag ? `${locText} ${flag}` : locText },
    ...(job.department ? [{ label: "부서", value: job.department }] : []),
    ...(level ? [{ label: "경력", value: level }] : []),
    { label: "고용형태", value: employmentLabel(job.employment_type) },
    // 무언급(null)이면 행 자체를 생략 — '없는 정보'를 표시하지 않는다.
    // true=지원(초록), false=공고가 명시적으로 거부(회색) — 지원 전 알아야 할 정보라 둘 다 표시.
    ...(job.relocation_support === true
      ? [{ label: "이주 지원", value: "회사가 이주(relocation)를 지원해요 ✈️", tone: "positive" as const }]
      : job.relocation_support === false
        ? [{ label: "이주 지원", value: "이주 지원 없음 (공고 명시)" }]
        : []),
    ...(language
      ? [{
          label: "어학",
          value: language,
          // english_only(현지어 불필요)와 korean(한국어 우대 포지션)은 한국 지원자에게 긍정 신호.
          tone:
            job.language_requirement === "english_only" || job.language_requirement === "korean"
              ? ("positive" as const)
              : undefined,
        }]
      : []),
    {
      label: "연봉",
      value: salaryKrw ?? salaryText ?? "공고 미기재",
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
          <dd
            className={cn(
              "text-body-sm font-semibold text-foreground",
              r.tone === "salary" && "text-primary",
              r.tone === "positive" && "text-success",
            )}
          >
            {r.value}
            {r.sub && <span className="ml-1.5 font-normal text-caption text-muted-foreground">{r.sub}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
