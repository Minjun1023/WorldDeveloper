package com.devjobs.analytics;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JobViewRepository extends JpaRepository<JobViewEntity, Long> {

    /** 고유 열람자/일 기준 1회만 기록(중복은 무시). viewed_on·created_at 은 기본값 사용. */
    @Modifying
    @Query(value = """
        INSERT INTO job_views (job_id, viewer_key, user_id)
        VALUES (:jobId, :viewerKey, :userId)
        ON CONFLICT (job_id, viewer_key, viewed_on) DO NOTHING
        """, nativeQuery = true)
    void record(@Param("jobId") String jobId, @Param("viewerKey") String viewerKey,
                @Param("userId") UUID userId);

    @Query(value = "SELECT count(*) FROM job_views", nativeQuery = true)
    long viewsTotal();

    @Query(value = "SELECT count(*) FROM job_views WHERE created_at > now() - make_interval(days => :days)",
        nativeQuery = true)
    long viewsSince(@Param("days") int days);

    @Query(value = "SELECT count(DISTINCT viewer_key) FROM job_views "
        + "WHERE created_at > now() - make_interval(days => :days)", nativeQuery = true)
    long uniqueViewersSince(@Param("days") int days);

    /** 서로 다른 2일 이상 방문한 고유 열람자 수(재방문 프록시). */
    @Query(value = "SELECT count(*) FROM (SELECT viewer_key FROM job_views "
        + "GROUP BY viewer_key HAVING count(DISTINCT viewed_on) >= 2) t", nativeQuery = true)
    long returningViewers();

    /** 최근 N일 조회 상위 공고: [job_id, count]. */
    @Query(value = "SELECT job_id, count(*) AS c FROM job_views "
        + "WHERE created_at > now() - make_interval(days => :days) "
        + "GROUP BY job_id ORDER BY c DESC LIMIT :limit", nativeQuery = true)
    List<Object[]> topJobsSince(@Param("days") int days, @Param("limit") int limit);

    /** 로그인 유저의 최근 본(열람) 활성 공고(공고당 최신 1건, 최신순): [id, title, slug, display_name, ts(ms)]. */
    @Query(value = """
        SELECT j.id, j.title, j.company_slug, c.display_name,
               EXTRACT(EPOCH FROM MAX(v.created_at)) * 1000 AS ts
        FROM job_views v
        JOIN jobs j ON j.id = v.job_id
        LEFT JOIN companies c ON c.slug = j.company_slug
        WHERE v.user_id = :uid AND j.is_active = true
        GROUP BY j.id, j.title, j.company_slug, c.display_name
        ORDER BY MAX(v.created_at) DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Object[]> recentViewedByUser(@Param("uid") UUID uid, @Param("limit") int limit);
}
