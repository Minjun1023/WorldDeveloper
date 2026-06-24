package com.devjobs.coach;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 공고 태그 + 본문에서 기술 스택 키워드를 뽑아낸다 (analyzers/stack.py 의 경량 포팅).
 * 인터뷰 단골 주제 매핑에 사용한다.
 */
final class TechExtractor {

    private TechExtractor() {}

    // 본문에서 찾을 키워드 — 단어 경계로 매칭 (javascript 안의 java 등 오탐 방지)
    private static final List<String> KEYWORDS = List.of(
        "python", "django", "flask", "fastapi",
        "react", "next.js", "nextjs", "typescript",
        "go", "golang", "java", "kotlin", "rust",
        "postgresql", "postgres", "mysql", "sql",
        "redis", "kafka", "rabbitmq",
        "aws", "gcp", "azure", "kubernetes", "k8s", "docker",
        "ml", "pytorch", "tensorflow", "ai");

    static Set<String> extract(List<String> tags, String descriptionText) {
        Set<String> skills = new LinkedHashSet<>();
        if (tags != null) {
            for (String t : tags) {
                if (t != null && !t.isBlank()) skills.add(t.toLowerCase());
            }
        }
        if (descriptionText != null && !descriptionText.isBlank()) {
            String body = descriptionText.toLowerCase();
            for (String kw : KEYWORDS) {
                if (containsToken(body, kw)) skills.add(kw);
            }
        }
        return skills;
    }

    // 표준형(canonical) → 표면형(별칭) 목록. 약어(k8s)·다른 표기(postgres)·한글 표기(쿠버네티스)를
    // 같은 스킬로 인식하기 위한 사전. 짧고 모호한 별칭(go의 '고', ts/js 등)은 오탐 위험으로 제외.
    // 키워드 추출(extract)은 그대로 두고, 이력서 보유/매칭 판정(containsSkill)에서만 별칭을 적용한다.
    private static final Map<String, List<String>> ALIASES = Map.ofEntries(
        Map.entry("kubernetes", List.of("k8s", "쿠버네티스")),
        Map.entry("docker", List.of("도커")),
        Map.entry("postgresql", List.of("postgres", "포스트그레스")),
        Map.entry("redis", List.of("레디스")),
        Map.entry("kafka", List.of("카프카")),
        Map.entry("rabbitmq", List.of("래빗엠큐")),
        Map.entry("react", List.of("리액트")),
        Map.entry("typescript", List.of("타입스크립트")),
        Map.entry("javascript", List.of("자바스크립트")),
        Map.entry("python", List.of("파이썬")),
        Map.entry("java", List.of("자바")),
        Map.entry("go", List.of("golang", "고랭")),
        Map.entry("rust", List.of("러스트")),
        Map.entry("kotlin", List.of("코틀린")),
        Map.entry("aws", List.of("amazon web services")),
        Map.entry("gcp", List.of("google cloud")),
        Map.entry("azure", List.of("애저")),
        Map.entry("graphql", List.of("그래프큐엘")),
        Map.entry("terraform", List.of("테라폼")),
        Map.entry("spring", List.of("스프링")),
        Map.entry("django", List.of("장고")));

    // 표면형 → 표준형 역인덱스 (표준형 자기 자신도 포함).
    private static final Map<String, String> SURFACE_TO_CANONICAL = buildReverse();

    private static Map<String, String> buildReverse() {
        Map<String, String> m = new HashMap<>();
        for (var e : ALIASES.entrySet()) {
            m.put(e.getKey(), e.getKey());
            for (String surface : e.getValue()) m.put(surface, e.getKey());
        }
        return m;
    }

    /** 별칭·약어·한글 표기를 표준 스킬명으로. 사전에 없으면 소문자화만 해서 그대로 반환. */
    static String canonical(String surface) {
        if (surface == null) return null;
        String s = surface.toLowerCase();
        return SURFACE_TO_CANONICAL.getOrDefault(s, s);
    }

    /** 표준 스킬의 모든 표면형(표준형 자기 자신 포함). 사전에 없으면 자기 자신만. */
    static List<String> surfaceFormsOf(String canonicalSkill) {
        String c = canonicalSkill == null ? "" : canonicalSkill.toLowerCase();
        List<String> aliases = ALIASES.get(c);
        if (aliases == null) return List.of(c);
        List<String> all = new ArrayList<>(aliases.size() + 1);
        all.add(c);
        all.addAll(aliases);
        return all;
    }

    /**
     * body 에 스킬이 표면형(약어·한글 별칭 포함) 중 하나라도 등장하면 true.
     * jobKeyword 가 표면형이어도 표준형 기준 전체 표면형으로 검사한다(postgres → postgresql 묶음).
     * 사전에 없는 키워드는 containsToken 과 동일하게 동작(하위호환).
     */
    static boolean containsSkill(String body, String jobKeyword) {
        for (String surface : surfaceFormsOf(canonical(jobKeyword))) {
            if (containsToken(body, surface)) return true;
        }
        return false;
    }

    // 점(.)이나 숫자가 섞인 토큰(next.js, k8s)은 단어 경계 정규식이 까다로워 substring 으로,
    // 일반 단어는 \bword\b 로 검사한다.
    // package-private: ResumeOptimizer 의 보유/매칭 판정도 동일 로직을 재사용한다.
    // 순수 알파벳 단어(go, java)는 \bword\b 로 오탐 방지(go∈google, ai∈trained).
    // 특수문자/숫자/공백 포함(next.js, k8s, c++, "distributed systems")은 substring.
    static boolean containsToken(String body, String kw) {
        if (kw.matches("[a-z]+")) {
            return Pattern.compile("\\b" + Pattern.quote(kw) + "\\b").matcher(body).find();
        }
        return body.contains(kw);
    }
}
