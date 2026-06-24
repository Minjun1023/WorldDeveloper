package com.devjobs.coach;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class TechExtractorTest {

    @Test
    void containsTokenUsesWordBoundaryForPlainWords() {
        // 회귀: substring 매칭이면 "go"가 google 안에, "ai"가 trained 안에 오탐 → 보유스킬/점수 부풀림.
        assertThat(TechExtractor.containsToken("worked at google cloud", "go")).isFalse();
        assertThat(TechExtractor.containsToken("trained a model", "ai")).isFalse();
        assertThat(TechExtractor.containsToken("javascript only", "java")).isFalse();
        assertThat(TechExtractor.containsToken("go developer for 5 years", "go")).isTrue();
        assertThat(TechExtractor.containsToken("built ai pipelines", "ai")).isTrue();
        assertThat(TechExtractor.containsToken("java and kotlin", "java")).isTrue();
    }

    @Test
    void containsTokenUsesSubstringForSymbolOrMultiwordTokens() {
        assertThat(TechExtractor.containsToken("built with next.js", "next.js")).isTrue();
        assertThat(TechExtractor.containsToken("k8s on prod", "k8s")).isTrue();
        assertThat(TechExtractor.containsToken("c++ and rust", "c++")).isTrue();
        assertThat(TechExtractor.containsToken("we run distributed systems", "distributed systems")).isTrue();
    }

    @Test
    void extractSeedsFromTagsAndBoundaryMatchesDescription() {
        Set<String> skills = TechExtractor.extract(
            List.of("kafka", "salesforce"), "Go backend with postgres; no google here");
        // 태그(rich)는 그대로 + 본문은 경계로 — 'go'는 'google'이 아니라 'Go backend'에서 잡힌다.
        assertThat(skills).contains("kafka", "salesforce", "go", "postgres");
    }

    @Test
    void canonicalMapsAliasesAndKoreanToCanonicalSkill() {
        assertThat(TechExtractor.canonical("k8s")).isEqualTo("kubernetes");
        assertThat(TechExtractor.canonical("쿠버네티스")).isEqualTo("kubernetes");
        assertThat(TechExtractor.canonical("postgres")).isEqualTo("postgresql");
        assertThat(TechExtractor.canonical("카프카")).isEqualTo("kafka");
        assertThat(TechExtractor.canonical("golang")).isEqualTo("go");
        // 사전에 없는 표면형은 그대로 (소문자화만)
        assertThat(TechExtractor.canonical("Salesforce")).isEqualTo("salesforce");
    }

    @Test
    void containsSkillRecognizesAliasAndKoreanSurfaceForms() {
        // 공고 키워드와 이력서 표기가 달라도(약어·한글) 같은 스킬로 매칭된다.
        assertThat(TechExtractor.containsSkill("operated a k8s cluster", "kubernetes")).isTrue();
        assertThat(TechExtractor.containsSkill("쿠버네티스 클러스터 운영", "kubernetes")).isTrue();
        assertThat(TechExtractor.containsSkill("도커로 컨테이너화해 배포했다", "docker")).isTrue();
        assertThat(TechExtractor.containsSkill("managed data in postgres", "postgresql")).isTrue();
        assertThat(TechExtractor.containsSkill("카프카 기반 파이프라인", "kafka")).isTrue();
        // 공고 키워드가 표면형으로 와도 표준형 기준으로 매칭(postgres → postgresql 표면형 묶음)
        assertThat(TechExtractor.containsSkill("uses postgresql heavily", "postgres")).isTrue();
        // 오탐 방지: 없는 스킬은 false, 단어경계도 유지
        assertThat(TechExtractor.containsSkill("only react here", "kubernetes")).isFalse();
        assertThat(TechExtractor.containsSkill("worked at google cloud", "go")).isFalse();
    }
}
