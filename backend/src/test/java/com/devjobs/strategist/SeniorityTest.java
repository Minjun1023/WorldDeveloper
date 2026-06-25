package com.devjobs.strategist;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

/** detect 의 레벨 추출(키워드·로마숫자·경력연수 폴백) 단위 테스트. */
class SeniorityTest {

    @Test
    void keywordInTitleWins() {
        assertEquals("staff", Seniority.detect("Staff Software Engineer", null, null));
        assertEquals("senior", Seniority.detect("Senior Backend Engineer", null, null));
        assertEquals("junior", Seniority.detect("Junior Developer", null, null));
        assertEquals("principal", Seniority.detect("Principal Engineer", null, 3));
    }

    @Test
    void romanNumeralLevels() {
        assertEquals("mid", Seniority.detect("Software Engineer II", null, null));
        assertEquals("senior", Seniority.detect("Security Engineer III", null, null));
        assertEquals("staff", Seniority.detect("Software Engineer IV", null, null));
    }

    @Test
    void experienceYearsFallbackWhenNoKeyword() {
        // 레벨 단어 없는 제목 → 경력연수로 추론 (보드의 ~43% 케이스)
        assertEquals("staff", Seniority.detect("Security Engineer", null, 8));
        assertEquals("senior", Seniority.detect("Postgres Engineer", null, 5));
        assertEquals("mid", Seniority.detect("Backend Engineer", null, 3));
        assertEquals("junior", Seniority.detect("Software Engineer", null, 1));
        assertEquals("junior", Seniority.detect("Software Engineer", null, 0));
    }

    @Test
    void keywordBeatsExperienceYears() {
        // 명시적 레벨 단어가 경력연수 폴백보다 우선
        assertEquals("senior", Seniority.detect("Senior Engineer", null, 1));
        assertEquals("junior", Seniority.detect("Graduate Engineer", null, 8));
    }

    @Test
    void unspecifiedWhenNoSignal() {
        assertEquals("unspecified", Seniority.detect("Software Engineer", null, null));
        assertEquals("unspecified", Seniority.detect(null, null, null));
    }

    @Test
    void fromExperienceYearsBoundaries() {
        assertEquals("unspecified", Seniority.fromExperienceYears(null));
        assertEquals("junior", Seniority.fromExperienceYears(2));
        assertEquals("mid", Seniority.fromExperienceYears(4));
        assertEquals("senior", Seniority.fromExperienceYears(7));
        assertEquals("staff", Seniority.fromExperienceYears(10));
    }
}
