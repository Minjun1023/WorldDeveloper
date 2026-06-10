import type { Job } from "@/lib/types";

// 회사 상세 페이지 통계 행은 회사의 공고 목록에서 직접 계산한다 (백엔드 추가 필드 없음).
// Readdy 목업의 설립연도/직원수 자리를 실데이터 기반 지표로 대체한다.
export interface CompanyStats {
  // 분석에 사용한 공고 수 (jobs 배열 길이)
  total: number;
  // 비자 스폰서 비율 (0-100, 정수). 공고가 없으면 null → 화면에서 "—" 처리.
  sponsorRatio: number | null;
  // 정부 명부(Home Office/USCIS) 대조로 검증된 공고 수
  verifiedCount: number;
  // 원격 가능 공고 수 (is_remote 이거나 원격 자격이 명시된 경우)
  remoteCount: number;
  // 공고 중 하나라도 명부 검증 → 회사 단위 "명부 검증" 신호 (히어로 배지에 사용)
  registerVerified: boolean;
}

function isRemoteCapable(job: Job): boolean {
  if (job.is_remote === true) return true;
  const e = job.remote?.eligibility;
  return e === "worldwide" || e === "apac_ok" || e === "region_restricted";
}

export function computeCompanyStats(jobs: Job[]): CompanyStats {
  const total = jobs.length;
  const sponsors = jobs.filter((j) => j.visa?.status === "sponsors").length;
  const verifiedCount = jobs.filter((j) => j.visa?.register_verified === true).length;
  const remoteCount = jobs.filter(isRemoteCapable).length;

  return {
    total,
    sponsorRatio: total > 0 ? Math.round((sponsors / total) * 100) : null,
    verifiedCount,
    remoteCount,
    registerVerified: verifiedCount > 0,
  };
}
