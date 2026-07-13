package com.devjobs.credits;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserAiCreditRepository
        extends JpaRepository<UserAiCreditEntity, UserAiCreditEntity.Key> {

    /**
     * 원자적 차감 — 단일 upsert 로 "오늘(KST) 사용량 < limit 이면 +1" 을 보장(동시 요청 안전).
     * day 가 오늘이 아니면(어제 행) 오늘로 리셋하며 1로 시작. 반환 1=차감 성공, 0=한도 소진.
     */
    @Modifying
    @Query(value = """
        INSERT INTO user_ai_credits (user_id, kind, day, used)
        VALUES (:userId, :kind, (now() AT TIME ZONE 'Asia/Seoul')::date, 1)
        ON CONFLICT (user_id, kind) DO UPDATE
        SET used = CASE WHEN user_ai_credits.day = excluded.day
                        THEN user_ai_credits.used + 1 ELSE 1 END,
            day = excluded.day
        WHERE user_ai_credits.day <> excluded.day OR user_ai_credits.used < :limit
        """, nativeQuery = true)
    int tryConsume(@Param("userId") UUID userId, @Param("kind") String kind, @Param("limit") int limit);

    /** 환불(예: AI 미연결로 실패) — 오늘 행에서만 1 되돌린다(자정 넘긴 환불은 무의미라 무시). */
    @Modifying
    @Query(value = """
        UPDATE user_ai_credits SET used = greatest(0, used - 1)
        WHERE user_id = :userId AND kind = :kind
          AND day = (now() AT TIME ZONE 'Asia/Seoul')::date
        """, nativeQuery = true)
    int refund(@Param("userId") UUID userId, @Param("kind") String kind);

    /** 오늘 사용량(행 없거나 어제 행이면 0). UI 잔여 표시용. */
    @Query(value = """
        SELECT CASE WHEN day = (now() AT TIME ZONE 'Asia/Seoul')::date THEN used ELSE 0 END
        FROM user_ai_credits WHERE user_id = :userId AND kind = :kind
        """, nativeQuery = true)
    Optional<Integer> usedToday(@Param("userId") UUID userId, @Param("kind") String kind);
}
