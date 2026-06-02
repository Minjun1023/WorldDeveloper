import { JobCard } from "@/components/job/JobCard";
import type { Job } from "@/lib/types";

// 홈 공고 섹션: 가로 슬라이드 대신 4개 고정 그리드. 나머지는 섹션 헤더의 "전체 보기"로.
// hideVisaBadge: 이미 전부 스폰서인 섹션(비자 스폰서십 공고)에선 비자 배지가 중복이라 숨김.
export function JobGrid({ jobs, hideVisaBadge = false }: { jobs: Job[]; hideVisaBadge?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} hideVisaBadge={hideVisaBadge} />
      ))}
    </div>
  );
}
