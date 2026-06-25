// 백엔드 GET /api/v1/jobs 응답 item 스키마 (DESIGN.md 5.1)

export type VisaStatus = "sponsors" | "no_sponsor" | "unclear";

export type RemoteEligibility =
  | "worldwide"
  | "apac_ok"
  | "region_restricted"
  | "unclear";

export interface JobCompany {
  slug: string;
  display_name: string;
  tags?: string[];
}

export interface JobVisa {
  status: VisaStatus;
  evidence?: string[];
  // 정부 공식 명부(UK Home Office / US USCIS) 대조로 확인된 스폰서인가 (최상위 신뢰 신호).
  register_verified?: boolean;
}

export interface JobRemote {
  eligibility?: RemoteEligibility | null;
  evidence?: string[];
}

export interface JobSalary {
  min_usd?: number | null;
  max_usd?: number | null;
  min?: number;
  max?: number;
  currency?: string;
  period?: string;
}

export interface Job {
  id: string;
  title: string;
  title_ko?: string;
  company: JobCompany;
  location?: string;
  location_ko?: string;
  is_remote?: boolean;
  employment_type?: string;
  description_preview?: string;
  apply_url?: string;
  posted_at?: string;
  closes_at?: string | null;
  tags?: string[];
  visa?: JobVisa;
  remote?: JobRemote;
  salary?: JobSalary;
  seniority?: string | null;
}

export interface JobDetail {
  id: string;
  title: string;
  title_ko?: string;
  company: JobCompany;
  location?: string;
  location_ko?: string;
  is_remote?: boolean;
  employment_type?: string;
  description?: string;
  apply_url?: string;
  posted_at?: string;
  closes_at?: string | null;
  tags?: string[];
  visa?: JobVisa;
  remote?: JobRemote;
  salary?: JobSalary;
  experience_years?: number | null;
  seniority?: string | null;
}

export interface Facets {
  visa_status?: Record<string, number>;
  is_remote?: Record<string, number>;
  remote_eligibility?: Record<string, number>;
}

export interface JobListResponse {
  items: Job[];
  page: number;
  page_size: number;
  total: number;
  facets: Facets;
}

export interface RecommendProfile {
  skills: string[];
  seniority: string;
  handle?: string | null;
  years_experience?: number;
  bio?: string;
  resume_text?: string;
  needs_visa_sponsorship?: boolean;
  preferred_locations?: string[];
  remote_preference?: string;
  desired_salary_usd?: number;
  excluded_companies?: string[];
  top_k?: number;
  max_per_company?: number;
}

export interface ScoreBreakdown {
  final_score: number;
  stack: number;
  visa: number;
  location: number;
  seniority: number;
  salary: number;
  semantic: number;
  penalty_applied: number;
  reasons: string[];
  deal_breakers: string[];
}

export interface RecommendationItem {
  job: Job;
  score: ScoreBreakdown;
}

export interface RecommendResponse {
  total_candidates: number;
  returned: number;
  recommendations: RecommendationItem[];
}

export interface CompanySummary {
  slug: string;
  display_name: string;
  tags?: string[];
  job_count: number;
  verified?: boolean;
  website_url?: string;
  /** 백엔드가 공고에서 파생한 대표 위치(큐레이션/스냅샷 없는 회사 카드 폴백). */
  location?: string;
}

export interface CompanyDetail {
  slug: string;
  display_name: string;
  ats?: string;
  tags?: string[];
  website_url?: string;
  job_count: number;
}

export interface CompanyListResponse {
  total: number;
  items: CompanySummary[];
}

// 인터뷰 준비 (coach: GET /jobs/{id}/interview-prep)
export interface InterviewStageKit {
  stage: string;
  label: string;
  duration: string;
  focus: string;
  common_questions: string[];
  preparation_actions: string[];
}

export interface InterviewDetectedContext {
  level: string;
  primary_stack: string | null;
  remote: boolean;
}

export interface InterviewPrep {
  job_id: string;
  title: string;
  company: string;
  stack_specific_topics: string[];
  questions_to_ask_them: string[];
  stages: InterviewStageKit[];
  detected?: InterviewDetectedContext;
  note: string;
}


// 공고 요약 (summarize: GET /jobs/{id}/summary?lang=ko)
export interface JobSummary {
  job_id: string;
  lang: string;
  responsibilities: string[];
  requirements: string[];
  visa: string[];
  compensation: string[];
  engine: string;
  cached: boolean;
}

// 거절 회복 (recovery: POST /applications/{jobId}/recovery)
export interface SimilarCompany {
  slug: string;
  display_name: string;
  job_count: number;
}

export interface RecoveryStats {
  total_applications: number;
  rejected_count: number;
  rejection_rate: number;
  stage_breakdown: Record<string, number>;
}

export interface Recovery {
  rejected_job_id: string;
  job_title?: string;
  company?: string;
  reason_logged?: string | null;
  tracker_updated: boolean;
  shared_tags: string[];
  similar_companies: SimilarCompany[];
  stats: RecoveryStats;
  next_actions: string[];
  encouragement: string;
}

export interface VisaGuide {
  text: string;
  sources: { title: string; url: string; retrieved_at: string }[];
  disclaimer: string;
}
