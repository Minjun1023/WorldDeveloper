package com.devjobs.scout;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** JobService.translateKoreanQuery 순수 단위 테스트(스프링 컨텍스트 불필요). */
class KoreanQueryTranslateTest {

    @Test
    void translatesKnownDisciplineTerms() {
        assertThat(JobService.translateKoreanQuery("백엔드")).isEqualTo("backend");
        assertThat(JobService.translateKoreanQuery("프론트엔드")).isEqualTo("frontend");
        assertThat(JobService.translateKoreanQuery("데이터")).isEqualTo("data");
        assertThat(JobService.translateKoreanQuery("머신러닝")).isEqualTo("machine learning");
    }

    @Test
    void longestKeyWinsOverSubstring() {
        // "프론트엔드"가 "프론트"보다 먼저 치환돼야 함
        assertThat(JobService.translateKoreanQuery("프론트엔드")).isEqualTo("frontend");
        // "데이터베이스"가 "데이터"보다 먼저
        assertThat(JobService.translateKoreanQuery("데이터베이스")).isEqualTo("database");
    }

    @Test
    void dropsGenericJobWordsToAvoidOverConstraining() {
        // "개발자/엔지니어"는 제거 → 핵심어만 남김
        assertThat(JobService.translateKoreanQuery("백엔드 개발자")).isEqualTo("backend");
        assertThat(JobService.translateKoreanQuery("데이터 엔지니어")).isEqualTo("data");
    }

    @Test
    void keepsEnglishTokensAndMixes() {
        assertThat(JobService.translateKoreanQuery("react")).isEqualTo("react");
        assertThat(JobService.translateKoreanQuery("백엔드 python")).isEqualTo("backend python");
    }

    @Test
    void dropsUntranslatedHangulToAvoidZeroMatch() {
        // "챗봇"은 사전에 없음 → 제거하고 backend 만 남겨 0매칭 방지
        assertThat(JobService.translateKoreanQuery("백엔드 챗봇")).isEqualTo("backend");
    }

    @Test
    void fallsBackToOriginalWhenNothingUsable() {
        // 전부 알 수 없는 한글 → 원문 유지(전체 반환 방지)
        assertThat(JobService.translateKoreanQuery("사회복지사")).isEqualTo("사회복지사");
    }

    @Test
    void nullAndBlankPassThrough() {
        assertThat(JobService.translateKoreanQuery(null)).isNull();
        assertThat(JobService.translateKoreanQuery("")).isEqualTo("");
    }
}
