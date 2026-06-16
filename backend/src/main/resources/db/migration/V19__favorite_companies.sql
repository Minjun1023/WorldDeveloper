-- 관심 기업(즐겨찾기): 회원이 기업을 북마크. saved_jobs 와 동일 패턴.
CREATE TABLE favorite_companies (
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_slug TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, company_slug)
);
CREATE INDEX idx_favorite_companies_user ON favorite_companies (user_id, created_at DESC);
