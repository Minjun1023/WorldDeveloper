-- 검색 실행 로그 (인기 검색어 토대). job_views 와 동일 패턴.
-- 검색자/일 기준 dedup: (term, searcher_key, searched_on) 유니크 → 한 사람이 같은 검색어를
-- 반복해도 하루 1카운트라 한쪽으로 부풀려지지 않는다.
-- term = 정규화된 검색어(소문자·trim·공백 단일화). searcher_key = 로그인 'u:'+userId / 익명 'a:'+sha256(ip+ua).
CREATE TABLE search_queries (
    id           BIGSERIAL PRIMARY KEY,
    term         TEXT NOT NULL,
    searcher_key TEXT NOT NULL,
    user_id      UUID,
    searched_on  DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (term, searcher_key, searched_on)
);

CREATE INDEX idx_search_queries_created_at ON search_queries (created_at);
CREATE INDEX idx_search_queries_term ON search_queries (term);
