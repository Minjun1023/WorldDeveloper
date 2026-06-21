package com.devjobs.popular;

import java.util.List;

/**
 * 인기 공고 직무 분류. title(주 신호) ~* titleRegex 또는 tags 배열 겹침(보조)으로 매칭.
 * Postgres ~* 는 대소문자 무시 regex, \y 는 단어 경계(ml 이 html 안에 매칭되지 않도록).
 */
public enum JobFunction {
    BACKEND("backend", "back[ -]?end|server[ -]?side|백엔드",
        List.of("java", "kotlin", "spring", "django", "flask", "fastapi", "go", "node.js",
            "express", "nestjs", "ruby", "rails", "php", "laravel", "scala", "backend")),
    FRONTEND("frontend", "front[ -]?end|프론트",
        List.of("react", "vue", "angular", "svelte", "next.js", "typescript", "javascript",
            "frontend", "tailwind")),
    FULLSTACK("fullstack", "full[ -]?stack|풀스택",
        List.of("fullstack", "full-stack")),
    MOBILE("mobile", "\\yios\\y|android|mobile|모바일|react native|flutter|swift",
        List.of("ios", "android", "swift", "flutter", "react-native", "swiftui")),
    DATA_ML("data_ml", "machine learning|\\yml\\y|\\yai\\y|data scien|data engineer|deep learning|데이터|ml engineer",
        List.of("machine-learning", "ml", "pytorch", "tensorflow", "nlp", "llm", "spark",
            "pandas", "data-science", "ai")),
    DEVOPS("devops", "devops|\\ysre\\y|site reliability|infrastructure|platform engineer|cloud engineer|인프라|kubernetes",
        List.of("devops", "kubernetes", "terraform", "docker", "aws", "gcp", "azure", "ansible", "sre"));

    public final String key;
    public final String titleRegex;
    public final List<String> tags;

    JobFunction(String key, String titleRegex, List<String> tags) {
        this.key = key;
        this.titleRegex = titleRegex;
        this.tags = tags;
    }

    /** Postgres text[] 리터럴(예: {react,next.js}). 태그는 영문/숫자/.- 만이라 따옴표 불필요. */
    public String tagArrayLiteral() {
        return "{" + String.join(",", tags) + "}";
    }

    public static JobFunction byKey(String key) {
        if (key == null || key.isBlank()) return null;
        for (JobFunction f : values()) {
            if (f.key.equals(key)) return f;
        }
        return null;
    }
}
