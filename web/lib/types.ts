// 백엔드 GET /api/v1/jobs 응답 item 스키마 (DESIGN.md 5.1)

export type VisaStatus = "sponsors" | "no_sponsor" | "unclear";

export interface JobCompany {
  slug: string;
  display_name: string;
  tags?: string[];
}

export interface JobVisa {
  status: VisaStatus;
  evidence?: string[];
}

export interface JobSalary {
  min_usd?: number | null;
  max_usd?: number | null;
}

export interface Job {
  id: string;
  title: string;
  company: JobCompany;
  location?: string;
  is_remote?: boolean;
  employment_type?: string;
  description_preview?: string;
  apply_url?: string;
  posted_at?: string;
  tags?: string[];
  visa?: JobVisa;
  salary?: JobSalary;
}

export interface JobDetail {
  id: string;
  title: string;
  company: JobCompany;
  location?: string;
  is_remote?: boolean;
  employment_type?: string;
  description?: string;
  apply_url?: string;
  posted_at?: string;
  tags?: string[];
  visa?: JobVisa;
  salary?: JobSalary;
}

export interface Facets {
  visa_status?: Record<string, number>;
  is_remote?: Record<string, number>;
}

export interface JobListResponse {
  items: Job[];
  page: number;
  page_size: number;
  total: number;
  facets: Facets;
}
