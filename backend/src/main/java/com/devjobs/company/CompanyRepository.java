package com.devjobs.company;

import com.devjobs.domain.CompanyEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompanyRepository extends JpaRepository<CompanyEntity, String> {

    // 회사별 active 공고 수가 있는 회사만 (디렉터리). 반환: [slug, count]
    @Query(value = """
        SELECT c.slug, count(j.id) AS job_count
        FROM companies c
        JOIN jobs j ON j.company_slug = c.slug AND j.is_active = true
        WHERE (:tag IS NULL OR :tag = ANY(c.tags))
        GROUP BY c.slug
        ORDER BY job_count DESC
        """, nativeQuery = true)
    List<Object[]> findWithJobCount(@Param("tag") String tag);

    @Query(value = "SELECT count(*) FROM jobs WHERE company_slug = :slug AND is_active = true",
        nativeQuery = true)
    long countActiveJobs(@Param("slug") String slug);
}
