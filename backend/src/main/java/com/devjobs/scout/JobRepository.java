package com.devjobs.scout;

import com.devjobs.domain.JobEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JobRepository
    extends JpaRepository<JobEntity, String>, JpaSpecificationExecutor<JobEntity> {

    List<JobEntity> findByCompanySlugAndIsActiveTrueOrderByPostedAtDesc(String companySlug);

    @Query(value = "SELECT visa_status, count(*) FROM jobs WHERE is_active = true GROUP BY visa_status",
        nativeQuery = true)
    List<Object[]> countByVisaStatus();

    @Query(value = "SELECT is_remote, count(*) FROM jobs WHERE is_active = true GROUP BY is_remote",
        nativeQuery = true)
    List<Object[]> countByRemote();

    // 추천 후보: 사용자 임베딩과 cosine 유사도 상위 (pgvector). 반환: [id, semantic(0~1)]
    @Query(value = """
        SELECT id, 1 - (embedding <=> CAST(:vec AS vector)) AS semantic
        FROM jobs
        WHERE is_active = true AND embedding IS NOT NULL
        ORDER BY embedding <=> CAST(:vec AS vector)
        LIMIT :lim
        """, nativeQuery = true)
    List<Object[]> findSemanticCandidates(@Param("vec") String vec, @Param("lim") int lim);

    // fallback (임베딩 없거나 ai 다운): 최신순. 반환: [id, 0.0]
    @Query(value = """
        SELECT id, CAST(0.0 AS double precision) AS semantic
        FROM jobs
        WHERE is_active = true
        ORDER BY posted_at DESC NULLS LAST
        LIMIT :lim
        """, nativeQuery = true)
    List<Object[]> findRecentCandidates(@Param("lim") int lim);
}
