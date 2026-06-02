package com.devjobs.strategist;

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
}
