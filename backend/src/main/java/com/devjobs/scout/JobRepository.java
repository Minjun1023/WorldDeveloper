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

    // 풀텍스트 검색(키워드 q + 직무 disc 모두 optional). disc 는 서버 큐레이션 tsquery 문자열.
    @Query(value = """
        SELECT id FROM jobs
        WHERE is_active = true
          AND (CAST(:q AS text) IS NULL OR search_tsv @@ websearch_to_tsquery('english', CAST(:q AS text)))
          AND (CAST(:disc AS text) IS NULL OR search_tsv @@ to_tsquery('english', CAST(:disc AS text)))
          AND (CAST(:visa AS text) IS NULL OR visa_status = CAST(:visa AS text))
          AND (CAST(:loc AS text) IS NULL OR lower(location) LIKE CAST(:loc AS text))
          AND (CAST(:remote AS boolean) IS NULL OR is_remote = CAST(:remote AS boolean))
        ORDER BY
          CASE WHEN :byRelevance THEN ts_rank(search_tsv, websearch_to_tsquery('english', CAST(:q AS text))) END DESC NULLS LAST,
          posted_at DESC NULLS LAST,
          id DESC
        LIMIT :lim OFFSET :off
        """, nativeQuery = true)
    List<String> searchIds(
        @Param("q") String q, @Param("disc") String disc, @Param("visa") String visa,
        @Param("loc") String loc, @Param("remote") Boolean remote, @Param("byRelevance") boolean byRelevance,
        @Param("lim") int lim, @Param("off") int off);

    @Query(value = """
        SELECT count(*) FROM jobs
        WHERE is_active = true
          AND (CAST(:q AS text) IS NULL OR search_tsv @@ websearch_to_tsquery('english', CAST(:q AS text)))
          AND (CAST(:disc AS text) IS NULL OR search_tsv @@ to_tsquery('english', CAST(:disc AS text)))
          AND (CAST(:visa AS text) IS NULL OR visa_status = CAST(:visa AS text))
          AND (CAST(:loc AS text) IS NULL OR lower(location) LIKE CAST(:loc AS text))
          AND (CAST(:remote AS boolean) IS NULL OR is_remote = CAST(:remote AS boolean))
        """, nativeQuery = true)
    long countSearch(
        @Param("q") String q, @Param("disc") String disc, @Param("visa") String visa,
        @Param("loc") String loc, @Param("remote") Boolean remote);

    @Query(value = "SELECT count(*) FROM jobs WHERE is_active = true AND location ILIKE CAST(:pattern AS text)",
        nativeQuery = true)
    long countActiveByLocationLike(@Param("pattern") String pattern);
}
