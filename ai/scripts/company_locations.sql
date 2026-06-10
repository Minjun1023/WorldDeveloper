-- 회사별 대표 위치: active 공고 중 가장 빈번한 location.
-- 순수 'Remote'(국가정보 없음)는 후순위로 밀어, 가능하면 실제 도시를 대표값으로.
SELECT company_slug, location
FROM (
  SELECT company_slug, location,
    row_number() OVER (
      PARTITION BY company_slug
      ORDER BY
        (lower(btrim(location)) IN ('remote','anywhere','worldwide','remote - anywhere','global')) ASC,
        count(*) DESC,
        max(last_seen_at) DESC
    ) AS rn
  FROM jobs
  WHERE is_active AND location IS NOT NULL AND btrim(location) <> ''
  GROUP BY company_slug, location
) t
WHERE rn = 1;
