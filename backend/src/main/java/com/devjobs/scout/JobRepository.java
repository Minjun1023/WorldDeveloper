package com.devjobs.scout;

import com.devjobs.domain.JobEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JobRepository extends JpaRepository<JobEntity, String> {

    // "노출 대상(live)" 공고 = is_active = true 이면서 마감일이 지나지 않은 것.
    // 마감일(closes_at)이 없으면 상시채용으로 보고 포함, 있으면 now() 이전이면 실시간 제외한다.
    // (ETL deactivate_expired 를 기다리지 않고 요청 시점에 즉시 만료 반영.)
    // 아래 모든 네이티브 쿼리에 동일 술어를 인라인했다 — 한 곳이라도 빠지면 카운트/목록이 어긋난다.
    @Query(value = """
        SELECT * FROM jobs
        WHERE company_slug = :slug AND is_active = true
          AND (closes_at IS NULL OR closes_at > now())
          AND NOT is_agency(company_slug)
        ORDER BY posted_at DESC NULLS LAST
        """, nativeQuery = true)
    List<JobEntity> findLiveByCompanySlug(@Param("slug") String slug);

    @Query(value = "SELECT visa_status, count(*) FROM jobs WHERE is_active = true AND (closes_at IS NULL OR closes_at > now()) AND NOT is_agency(company_slug) GROUP BY visa_status",
        nativeQuery = true)
    List<Object[]> countByVisaStatus();

    @Query(value = "SELECT is_remote, count(*) FROM jobs WHERE is_active = true AND (closes_at IS NULL OR closes_at > now()) AND NOT is_agency(company_slug) GROUP BY is_remote",
        nativeQuery = true)
    List<Object[]> countByRemote();

    @Query(value = "SELECT remote_eligibility, count(*) FROM jobs WHERE is_active = true AND (closes_at IS NULL OR closes_at > now()) AND NOT is_agency(company_slug) GROUP BY remote_eligibility",
        nativeQuery = true)
    List<Object[]> countByRemoteEligibility();

    // 추천 후보: 사용자 임베딩과 cosine 유사도 상위 (pgvector). 반환: [id, semantic(0~1)]
    @Query(value = """
        SELECT id, 1 - (embedding <=> CAST(:vec AS vector)) AS semantic
        FROM jobs
        WHERE is_active = true AND (closes_at IS NULL OR closes_at > now()) AND NOT is_agency(company_slug) AND embedding IS NOT NULL
        ORDER BY embedding <=> CAST(:vec AS vector)
        LIMIT :lim
        """, nativeQuery = true)
    List<Object[]> findSemanticCandidates(@Param("vec") String vec, @Param("lim") int lim);

    // 추천 후보 보강: 한국 거주자 가능 원격(worldwide/apac_ok) 중 유사도 상위만 별도 조회.
    // 원격 viable 공고가 일반 후보 풀에서 빅테크에 밀려 안 뜨는 문제(recall) 완화 — 호출부에서
    // 일반 후보와 병합(dedupe)해 점수화한다. 반환: [id, semantic(0~1)]
    @Query(value = """
        SELECT id, 1 - (embedding <=> CAST(:vec AS vector)) AS semantic
        FROM jobs
        WHERE is_active = true AND (closes_at IS NULL OR closes_at > now()) AND NOT is_agency(company_slug) AND embedding IS NOT NULL
          AND is_remote = true AND remote_eligibility IN ('worldwide','apac_ok')
        ORDER BY embedding <=> CAST(:vec AS vector)
        LIMIT :lim
        """, nativeQuery = true)
    List<Object[]> findSemanticRemoteViableCandidates(@Param("vec") String vec, @Param("lim") int lim);

    // fallback (임베딩 없거나 ai 다운): 최신순. 반환: [id, 0.0]
    @Query(value = """
        SELECT id, CAST(0.0 AS double precision) AS semantic
        FROM jobs
        WHERE is_active = true AND (closes_at IS NULL OR closes_at > now()) AND NOT is_agency(company_slug)
        ORDER BY posted_at DESC NULLS LAST
        LIMIT :lim
        """, nativeQuery = true)
    List<Object[]> findRecentCandidates(@Param("lim") int lim);

    // fallback 모드용 원격 viable 보강 — 임베딩이 없을 때도 worldwide/apac_ok 원격을 후보에
    // 넣어 recall 을 유지(최신순). 반환: [id, 0.0]
    @Query(value = """
        SELECT id, CAST(0.0 AS double precision) AS semantic
        FROM jobs
        WHERE is_active = true AND (closes_at IS NULL OR closes_at > now()) AND NOT is_agency(company_slug)
          AND is_remote = true AND remote_eligibility IN ('worldwide','apac_ok')
        ORDER BY posted_at DESC NULLS LAST
        LIMIT :lim
        """, nativeQuery = true)
    List<Object[]> findRecentRemoteViableCandidates(@Param("lim") int lim);

    // 풀텍스트 검색(키워드 q + 직무 disc + 지역 regionRegex 모두 optional). disc 는 서버 큐레이션 tsquery 문자열.
    // visaPriority=true 면 비자 티어(sponsors→unclear→no_sponsor)를 1순위로 정렬한다.
    @Query(value = """
        SELECT id FROM jobs
        WHERE is_active = true AND (closes_at IS NULL OR closes_at > now()) AND NOT is_agency(company_slug)
          AND (CAST(:q AS text) IS NULL OR search_tsv @@ websearch_to_tsquery('english', CAST(:q AS text)))
          AND (CAST(:disc AS text) IS NULL OR search_tsv @@ to_tsquery('english', CAST(:disc AS text)))
          AND (CAST(:regionRegex AS text) IS NULL OR location ~* CAST(:regionRegex AS text))
          AND (CAST(:visa AS text) IS NULL OR visa_status = CAST(:visa AS text))
          AND (CAST(:loc AS text) IS NULL OR lower(location) LIKE CAST(:loc AS text))
          AND (
            CAST(:remote AS boolean) IS NULL
            OR (CAST(:remote AS boolean) = true
                AND is_remote = true
                AND remote_eligibility IS DISTINCT FROM 'region_restricted')
            OR (CAST(:remote AS boolean) = false AND is_remote = false)
          )
          AND (
            CAST(:gateMode AS text) = 'all'
            OR (CAST(:gateMode AS text) = 'both' AND (visa_status = 'sponsors' OR remote_eligibility IN ('worldwide','apac_ok')))
            OR (CAST(:gateMode AS text) = 'remote' AND remote_eligibility IN ('worldwide','apac_ok'))
            OR (CAST(:gateMode AS text) = 'remote_unclear' AND remote_eligibility IN ('worldwide','apac_ok','unclear'))
            OR (CAST(:gateMode AS text) = 'relocation' AND visa_status = 'sponsors')
            OR (CAST(:gateMode AS text) = 'relocation_unclear' AND visa_status IN ('sponsors','unclear'))
          )
        ORDER BY
          CASE WHEN :remotePriority THEN
            (CASE remote_eligibility WHEN 'worldwide' THEN 0 WHEN 'apac_ok' THEN 1 ELSE 2 END)
          ELSE 0 END ASC,
          CASE WHEN :visaPriority THEN
            (CASE visa_status WHEN 'sponsors' THEN 0 WHEN 'no_sponsor' THEN 2 ELSE 1 END)
          ELSE 0 END ASC,
          CASE WHEN :byRelevance THEN ts_rank(search_tsv, websearch_to_tsquery('english', CAST(:q AS text))) END DESC NULLS LAST,
          posted_at DESC NULLS LAST,
          id DESC
        LIMIT :lim OFFSET :off
        """, nativeQuery = true)
    List<String> searchIds(
        @Param("q") String q, @Param("disc") String disc, @Param("regionRegex") String regionRegex,
        @Param("visa") String visa, @Param("loc") String loc, @Param("remote") Boolean remote,
        @Param("gateMode") String gateMode, @Param("remotePriority") boolean remotePriority,
        @Param("visaPriority") boolean visaPriority, @Param("byRelevance") boolean byRelevance,
        @Param("lim") int lim, @Param("off") int off);

    @Query(value = """
        SELECT count(*) FROM jobs
        WHERE is_active = true AND (closes_at IS NULL OR closes_at > now()) AND NOT is_agency(company_slug)
          AND (CAST(:q AS text) IS NULL OR search_tsv @@ websearch_to_tsquery('english', CAST(:q AS text)))
          AND (CAST(:disc AS text) IS NULL OR search_tsv @@ to_tsquery('english', CAST(:disc AS text)))
          AND (CAST(:regionRegex AS text) IS NULL OR location ~* CAST(:regionRegex AS text))
          AND (CAST(:visa AS text) IS NULL OR visa_status = CAST(:visa AS text))
          AND (CAST(:loc AS text) IS NULL OR lower(location) LIKE CAST(:loc AS text))
          AND (
            CAST(:remote AS boolean) IS NULL
            OR (CAST(:remote AS boolean) = true
                AND is_remote = true
                AND remote_eligibility IS DISTINCT FROM 'region_restricted')
            OR (CAST(:remote AS boolean) = false AND is_remote = false)
          )
          AND (
            CAST(:gateMode AS text) = 'all'
            OR (CAST(:gateMode AS text) = 'both' AND (visa_status = 'sponsors' OR remote_eligibility IN ('worldwide','apac_ok')))
            OR (CAST(:gateMode AS text) = 'remote' AND remote_eligibility IN ('worldwide','apac_ok'))
            OR (CAST(:gateMode AS text) = 'remote_unclear' AND remote_eligibility IN ('worldwide','apac_ok','unclear'))
            OR (CAST(:gateMode AS text) = 'relocation' AND visa_status = 'sponsors')
            OR (CAST(:gateMode AS text) = 'relocation_unclear' AND visa_status IN ('sponsors','unclear'))
          )
        """, nativeQuery = true)
    long countSearch(
        @Param("q") String q, @Param("disc") String disc, @Param("regionRegex") String regionRegex,
        @Param("visa") String visa, @Param("loc") String loc, @Param("remote") Boolean remote,
        @Param("gateMode") String gateMode);

    @Query(value = "SELECT count(*) FROM jobs WHERE is_active = true AND (closes_at IS NULL OR closes_at > now()) AND NOT is_agency(company_slug) AND is_remote = true",
        nativeQuery = true)
    long countActiveRemote();

    @Query(value = "SELECT count(*) FROM jobs WHERE is_active = true AND (closes_at IS NULL OR closes_at > now()) AND NOT is_agency(company_slug) AND location ~* CAST(:regex AS text)",
        nativeQuery = true)
    long countActiveByLocationRegex(@Param("regex") String regex);
}
