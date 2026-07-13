package com.devjobs.credits;

import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 계정별 AI 크레딧(일일 한도) — 유료 AI 경로의 사용자당 하루 사용량 상한.
 * 시간당 레이트리밋(버스트 보호)과 별개로, 하루 총량(비용)을 계정 단위로 캡한다.
 * 결제/충전이 없는 현 단계에서는 매일 KST 자정에 자연 리셋되는 무료 할당 모델.
 *
 * kind 별 한도: coach(이력서 코치 챗) / summary(공고 AI 요약, 캐시 미스만) /
 * note(맞춤 추천의 자연어 조건 파싱). 전부 env 로 조절.
 */
@Service
public class AiCreditService {

    public static final String KIND_COACH = "coach";
    public static final String KIND_SUMMARY = "summary";
    public static final String KIND_NOTE = "note";

    private final UserAiCreditRepository repo;
    private final Map<String, Integer> dailyLimits;

    public AiCreditService(UserAiCreditRepository repo,
                           @Value("${app.credits.coach-daily:30}") int coachDaily,
                           @Value("${app.credits.summary-daily:30}") int summaryDaily,
                           @Value("${app.credits.note-daily:20}") int noteDaily) {
        this.repo = repo;
        this.dailyLimits = Map.of(
            KIND_COACH, coachDaily,
            KIND_SUMMARY, summaryDaily,
            KIND_NOTE, noteDaily);
    }

    /** 1회 차감 시도. false = 오늘 한도 소진. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean tryConsume(UUID userId, String kind) {
        return repo.tryConsume(userId, kind, dailyLimit(kind)) == 1;
    }

    /** 1회 환불 — AI 미연결 등 서비스 귀책 실패 시(사용자 과금 방지). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void refund(UUID userId, String kind) {
        repo.refund(userId, kind);
    }

    /** 오늘 잔여 크레딧(UI 표시용). */
    @Transactional(readOnly = true)
    public int remaining(UUID userId, String kind) {
        int used = repo.usedToday(userId, kind).orElse(0);
        return Math.max(0, dailyLimit(kind) - used);
    }

    public int dailyLimit(String kind) {
        Integer limit = dailyLimits.get(kind);
        if (limit == null) {
            throw new IllegalArgumentException("unknown credit kind: " + kind);
        }
        return limit;
    }
}
