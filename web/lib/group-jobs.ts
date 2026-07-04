import type { Job } from "@/lib/types";

export type GroupedJob = { job: Job; extraLocations: number };

/**
 * 같은 회사 + 같은 직함이 지역만 다르게 연속으로 나오는 결과를 한 행으로 접는다
 * (크롤링이 multi-location 공고를 지역별 개별 공고로 만들어 "도배"처럼 보이는 문제).
 * 최신순 정렬에서 동일 배치는 인접하므로 인접 그룹핑으로 충분 — 전역 dedup 은
 * 페이지 경계·정렬 안정성을 해쳐 의도적으로 하지 않는다.
 */
export function groupAdjacentJobs(jobs: Job[]): GroupedJob[] {
  const out: GroupedJob[] = [];
  for (const j of jobs) {
    const last = out[out.length - 1];
    if (
      last &&
      last.job.company.slug === j.company.slug &&
      (last.job.title_ko ?? last.job.title) === (j.title_ko ?? j.title)
    ) {
      last.extraLocations += 1;
      continue;
    }
    out.push({ job: j, extraLocations: 0 });
  }
  return out;
}
