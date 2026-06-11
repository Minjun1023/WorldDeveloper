package com.devjobs.scout;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TitleLocalizerTest {

    @Test
    void localizesStandardDevTitles() {
        assertThat(TitleLocalizer.localize("Senior Software Engineer")).isEqualTo("시니어 소프트웨어 엔지니어");
        assertThat(TitleLocalizer.localize("Backend Engineer")).isEqualTo("백엔드 엔지니어");
        assertThat(TitleLocalizer.localize("Engineering Manager")).isEqualTo("엔지니어링 매니저");
        assertThat(TitleLocalizer.localize("Data Scientist")).isEqualTo("데이터 사이언티스트");
    }

    @Test
    void fixesSeniorityTermsThatMtGetsWrong() {
        // MT 는 "직원 Backend 엔지니어"로 오역 — 글로서리는 직급을 정확히.
        assertThat(TitleLocalizer.localize("Staff Backend Engineer")).isEqualTo("스태프 백엔드 엔지니어");
        // MT 는 "기술 책임자"(리더)로 격상 오역 — IC 직책 유지.
        assertThat(TitleLocalizer.localize("Member of Technical Staff")).isEqualTo("테크니컬 스태프");
        assertThat(TitleLocalizer.localize("Principal Machine Learning Engineer"))
            .isEqualTo("프린시펄 머신러닝 엔지니어");
    }

    @Test
    void compoundPhrasesBeatWordByWord() {
        // "Machine Learning" 합성어 → 머신러닝(머신 러닝 아님)
        assertThat(TitleLocalizer.localize("Machine Learning Engineer")).isEqualTo("머신러닝 엔지니어");
        assertThat(TitleLocalizer.localize("Full Stack Developer")).isEqualTo("풀스택 개발자");
    }

    @Test
    void keepsAcronymsAndPunctuation() {
        assertThat(TitleLocalizer.localize("Site Reliability Engineer (SRE)"))
            .isEqualTo("사이트 신뢰성 엔지니어 (SRE)");
        assertThat(TitleLocalizer.localize("DevOps Engineer")).isEqualTo("DevOps 엔지니어");
        assertThat(TitleLocalizer.localize("Engineering Manager - Payments"))
            .isEqualTo("엔지니어링 매니저 - 결제");
    }

    @Test
    void wordBoundaryNoFalseMatch() {
        // "data"가 "database"를 망가뜨리지 않음(Database 는 자체 매핑)
        assertThat(TitleLocalizer.localize("Database Engineer")).isEqualTo("데이터베이스 엔지니어");
    }

    @Test
    void returnsNullWhenNoGlossaryHit() {
        // 전부 미등록 영어 → 한글 0 → null(호출부는 영어만 표시)
        assertThat(TitleLocalizer.localize("Sales Account Executive")).isNull();
        assertThat(TitleLocalizer.localize("")).isNull();
        assertThat(TitleLocalizer.localize(null)).isNull();
    }

    @Test
    void leavesJapaneseOrKoreanTitlesUntouched() {
        // 이미 CJK 포함(일본어 등)이면 Phase 2 대상 — null 반환(원문 유지).
        assertThat(TitleLocalizer.localize("バックエンドエンジニア")).isNull();
        assertThat(TitleLocalizer.localize("シニアSREエンジニア")).isNull();
    }
}
