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
        WHERE (:tag IS NULL OR :tag = ANY(c.tags))
        GROUP BY c.slug
        ORDER BY job_count DESC
        """, nativeQuery = true)
    List<Object[]> findWithJobCount(@Param("tag") String tag);

    @Query(value = "SELECT count(*) FROM jobs WHERE company_slug = :slug AND is_active = true "
        + "AND (closes_at IS NULL OR closes_at > now())",
        nativeQuery = true)
    long countActiveJobs(@Param("slug") String slug);

    // 태그가 겹치는(&&) 다른 회사 — active 공고 보유 회사만. 반환: [slug, display_name, job_count]
    @Query(value = """
        SELECT c.slug, c.display_name, count(j.id) AS job_count
        FROM companies c
        JOIN jobs j ON j.company_slug = c.slug AND j.is_active = true AND (j.closes_at IS NULL OR j.closes_at > now())
        WHERE c.tags && CAST(:tags AS text[]) AND c.slug <> :excludeSlug
        GROUP BY c.slug, c.display_name
        ORDER BY job_count DESC
        LIMIT 8
        """, nativeQuery = true)
    List<Object[]> findSimilarByTags(@Param("tags") String tags,
                                     @Param("excludeSlug") String excludeSlug);
}
