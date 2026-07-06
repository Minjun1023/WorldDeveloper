package com.devjobs.feedback;

import com.devjobs.domain.JobEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface SavedJobRepository extends JpaRepository<SavedJobEntity, SavedJobEntity.Key> {
    List<SavedJobEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);

    // 마감 전환됐지만 아직 통지 안 된 저장 공고 (마감 = 비활성 또는 마감일 경과).
    @Query(value = """
        SELECT j.* FROM jobs j
        JOIN saved_jobs sj ON sj.job_id = j.id
        WHERE sj.user_id = :userId AND sj.closed_notified_at IS NULL
          AND (j.is_active = false OR (j.closes_at IS NOT NULL AND j.closes_at < now()))
        ORDER BY sj.created_at DESC
        """, nativeQuery = true)
    List<JobEntity> findClosedUnnotifiedByUser(@Param("userId") UUID userId);

    // 통지 완료 마킹 — 다음 배치에서 같은 공고를 다시 알리지 않는다(행 단위 멱등).
    @Modifying
    @Transactional
    @Query(value = "UPDATE saved_jobs SET closed_notified_at = now() WHERE user_id = :userId AND job_id IN (:jobIds)",
        nativeQuery = true)
    void markClosedNotified(@Param("userId") UUID userId, @Param("jobIds") Collection<String> jobIds);
}
