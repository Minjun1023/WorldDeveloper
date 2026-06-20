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
}
