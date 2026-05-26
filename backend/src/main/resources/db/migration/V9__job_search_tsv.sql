-- jobs 풀텍스트 검색: 제목(A)/회사명(B)/태그(B)/설명(D) 가중치 tsvector + GIN 인덱스.
-- 트리거로 유지(회사명은 슬러그로 companies 조회). ddl-auto=validate 안전(엔티티 미매핑 → 추가 컬럼 무시).
ALTER TABLE jobs ADD COLUMN search_tsv tsvector;

CREATE OR REPLACE FUNCTION jobs_search_tsv_update() RETURNS trigger AS $$
BEGIN
    NEW.search_tsv :=
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(
            (SELECT display_name FROM companies WHERE slug = NEW.company_slug), '')), 'B') ||
        setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.description_text, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jobs_search_tsv
    BEFORE INSERT OR UPDATE OF title, company_slug, tags, description_text ON jobs
    FOR EACH ROW EXECUTE FUNCTION jobs_search_tsv_update();

-- 기존 행 backfill
UPDATE jobs SET search_tsv =
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(
        (SELECT display_name FROM companies WHERE slug = jobs.company_slug), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description_text, '')), 'D');

CREATE INDEX idx_jobs_search_tsv ON jobs USING GIN (search_tsv);
