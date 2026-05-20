package com.devjobs.coach;

import java.util.LinkedHashSet;
import java.util.List;
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

    // 점(.)이나 숫자가 섞인 토큰(next.js, k8s)은 단어 경계 정규식이 까다로워 substring 으로,
    // 일반 단어는 \bword\b 로 검사한다.
    private static boolean containsToken(String body, String kw) {
        if (kw.contains(".") || kw.matches(".*\\d.*")) {
            return body.contains(kw);
        }
        return Pattern.compile("\\b" + Pattern.quote(kw) + "\\b").matcher(body).find();
    }
}
