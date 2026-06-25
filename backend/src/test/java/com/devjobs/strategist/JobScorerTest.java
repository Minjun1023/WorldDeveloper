package com.devjobs.strategist;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/** isKoreaViableRemote 순수 로직 단위 테스트 (한국 거주자 원격 적격 판정). */
class JobScorerTest {

    @Test
    void worldwideRemoteIsViable() {
        assertTrue(JobScorer.isKoreaViableRemote(true, "worldwide"));
    }

    @Test
    void apacRemoteIsViable() {
        assertTrue(JobScorer.isKoreaViableRemote(true, "apac_ok"));
    }

    @Test
    void unclearRemoteStaysViable() {
        // 권역 불명은 보수적으로 원격 인정 (확신 있을 때만 강등)
        assertTrue(JobScorer.isKoreaViableRemote(true, "unclear"));
        assertTrue(JobScorer.isKoreaViableRemote(true, null));
    }

    @Test
    void regionRestrictedRemoteIsNotViable() {
        // 비-한국 권역 한정 원격은 한국 거주자가 실제 원격 불가 → 원격 아님 취급
        assertFalse(JobScorer.isKoreaViableRemote(true, "region_restricted"));
    }

    @Test
    void onsiteIsNotRemote() {
        assertFalse(JobScorer.isKoreaViableRemote(false, "worldwide"));
        assertFalse(JobScorer.isKoreaViableRemote(false, null));
        assertFalse(JobScorer.isKoreaViableRemote(null, "worldwide"));
    }

    // --- over-leveled 패널티: 신입이 스태프/시니어 공고를 1순위로 보지 않게 ---

    @Test
    void overLeveledThreeStepsHeavyPenalty() {
        // 신입↔스태프(3), 주니어↔프린시플(4) → 0.3 배
        assertEquals(0.3, Seniority.overLevelPenalty("entry", "staff"), 1e-9);
        assertEquals(0.3, Seniority.overLevelPenalty("junior", "principal"), 1e-9);
    }

    @Test
    void overLeveledTwoStepsModeratePenalty() {
        // 신입↔시니어(2), 미들↔스태프(2) → 0.6 배
        assertEquals(0.6, Seniority.overLevelPenalty("entry", "senior"), 1e-9);
        assertEquals(0.6, Seniority.overLevelPenalty("mid", "staff"), 1e-9);
    }

    @Test
    void sameOneStepOrLowerNoPenalty() {
        assertEquals(1.0, Seniority.overLevelPenalty("senior", "senior"), 1e-9); // 동급
        assertEquals(1.0, Seniority.overLevelPenalty("junior", "mid"), 1e-9);    // 1단계 도전 OK
        assertEquals(1.0, Seniority.overLevelPenalty("staff", "junior"), 1e-9);  // 하위 공고는 패널티 X
    }

    @Test
    void unknownLevelNoPenalty() {
        assertEquals(1.0, Seniority.overLevelPenalty("entry", "unspecified"), 1e-9);
        assertEquals(1.0, Seniority.overLevelPenalty(null, "staff"), 1e-9);
    }

    @Test
    void visaSponsorsTopScore() {
        assertEquals(1.0, JobScorer.scoreVisa(true, "sponsors"), 1e-9);
    }

    @Test
    void visaUnclearRaisedFloor() {
        // unclear 는 '스폰서 안 함'이 아니라 '확인 안 됨' → 0.6 (스택 더 맞는 공고가 밀리지 않게)
        assertEquals(0.6, JobScorer.scoreVisa(true, "unclear"), 1e-9);
        assertEquals(0.6, JobScorer.scoreVisa(true, null), 1e-9);
    }

    @Test
    void visaNoSponsorZeroOnAxis() {
        // 축 점수는 0 (추가로 deal-breaker ×0.1 도 별도 적용됨)
        assertEquals(0.0, JobScorer.scoreVisa(true, "no_sponsor"), 1e-9);
    }

    @Test
    void visaIgnoredWhenNotNeeded() {
        assertEquals(1.0, JobScorer.scoreVisa(false, "unclear"), 1e-9);
    }
}
