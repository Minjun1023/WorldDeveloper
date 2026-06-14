package com.devjobs.company;

import com.devjobs.domain.CompanyEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompanyRepository extends JpaRepository<CompanyEntity, String> {

    // 회사별 active 공고 수가 있는 회사만 (디렉터리). 반환: [slug, count, verified]
    // verified = 공고 중 하나라도 정부 명부 근거(Home Office/USCIS)를 가진 경우
    //            (JobService.isRegisterVerified 와 동일 앵커).
    @Query(value = """
        SELECT c.slug, count(j.id) AS job_count,
          bool_or(
            jsonb_typeof(j.visa_evidence) = 'array'
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(j.visa_evidence) ev
              WHERE ev LIKE '%Home Office%' OR ev LIKE '%USCIS%'
            )
          ) AS verified
        FROM companies c
        JOIN jobs j ON j.company_slug = c.slug AND j.is_active = true AND (j.closes_at IS NULL OR j.closes_at > now())
          AND (j.visa_status = 'sponsors' OR j.remote_eligibility IN ('worldwide','apac_ok'))
        WHERE (:tag IS NULL OR :tag = ANY(c.tags)) AND NOT is_agency(c.slug)
        GROUP BY c.slug
        ORDER BY job_count DESC
        """, nativeQuery = true)
    List<Object[]> findWithJobCount(@Param("tag") String tag);

    @Query(value = "SELECT count(*) FROM jobs WHERE company_slug = :slug AND is_active = true "
        + "AND (closes_at IS NULL OR closes_at > now()) "
        + "AND (visa_status = 'sponsors' OR remote_eligibility IN ('worldwide','apac_ok'))",
        nativeQuery = true)
    long countActiveJobs(@Param("slug") String slug);

    // 태그가 겹치는(&&) 다른 회사 — active 공고 보유 회사만. 반환: [slug, display_name, job_count]
    @Query(value = """
        SELECT c.slug, c.display_name, count(j.id) AS job_count
        FROM companies c
        JOIN jobs j ON j.company_slug = c.slug AND j.is_active = true AND (j.closes_at IS NULL OR j.closes_at > now())
          AND (j.visa_status = 'sponsors' OR j.remote_eligibility IN ('worldwide','apac_ok'))
        WHERE c.tags && CAST(:tags AS text[]) AND c.slug <> :excludeSlug AND NOT is_agency(c.slug)
        GROUP BY c.slug, c.display_name
        ORDER BY job_count DESC
        LIMIT 8
        """, nativeQuery = true)
    List<Object[]> findSimilarByTags(@Param("tags") String tags,
                                     @Param("excludeSlug") String excludeSlug);

    // 큐레이션 태그가 빈 회사용 대체: 회사별 active 공고 기술태그 상위 N개(빈도순). 반환: [company_slug, tag]
    // 에이전시 공고는 제외(NOT is_agency). 호출부에서 빈-태그 회사 slug 목록만 넘긴다.
    @Query(value = """
        SELECT company_slug, tag FROM (
          SELECT j.company_slug, t.tag,
                 row_number() OVER (PARTITION BY j.company_slug ORDER BY count(*) DESC, t.tag) AS rn
          FROM jobs j, unnest(j.tags) AS t(tag)
          WHERE j.is_active = true AND (j.closes_at IS NULL OR j.closes_at > now())
            AND NOT is_agency(j.company_slug)
            -- 기술태그만 남긴다: 소문자(기술태그 컨벤션, Title-Case 일반문구 배제) + 길이상한
            -- + 학위/언어/소프트스킬 stoplist 제외(예 "master's degree", communication).
            AND t.tag = lower(t.tag) AND length(t.tag) <= 30
            AND t.tag !~ '(degree|diploma|fluent|english|german|deutsch|communication|leadership)'
            AND j.company_slug IN (:slugs)
          GROUP BY j.company_slug, t.tag
        ) s
        WHERE rn <= :lim
        ORDER BY company_slug, rn
        """, nativeQuery = true)
    List<Object[]> findTopJobTagsForSlugs(@Param("slugs") List<String> slugs, @Param("lim") int lim);

    // 회사별 대표 위치(active 공고 location 최빈값). 큐레이션/스냅샷이 없는 회사 카드의 위치 폴백용.
    // 에이전시 제외, 빈 location 제외. 반환: [company_slug, location]
    @Query(value = """
        SELECT company_slug, location FROM (
          SELECT j.company_slug, j.location,
                 row_number() OVER (PARTITION BY j.company_slug ORDER BY count(*) DESC, j.location) AS rn
          FROM jobs j
          WHERE j.is_active = true AND (j.closes_at IS NULL OR j.closes_at > now())
            AND NOT is_agency(j.company_slug)
            AND j.location IS NOT NULL AND btrim(j.location) <> ''
            AND j.company_slug IN (:slugs)
          GROUP BY j.company_slug, j.location
        ) s
        WHERE rn = 1
        ORDER BY company_slug
        """, nativeQuery = true)
    List<Object[]> findTopJobLocationForSlugs(@Param("slugs") List<String> slugs);
}
