-- 미 노동부 LCA 공시 기반 회사별 H-1B 신고 연봉(소프트웨어 직군, Certified 만).
-- scripts/import_lca_wages.py 가 분기 파일에서 집계해 적재. 표본 5건 미만은 미저장.
CREATE TABLE IF NOT EXISTS company_h1b_wages (
    company_slug TEXT PRIMARY KEY,
    cases        INT  NOT NULL,          -- 집계에 쓴 LCA 건수(표본 크기 표시용)
    median_wage  INT  NOT NULL,          -- 연봉 중앙값 (USD/년)
    p25_wage     INT,
    p75_wage     INT,
    period       TEXT NOT NULL,          -- 데이터 출처 분기 표기 (예: 'FY2026_Q1 + FY2025_Q4')
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
