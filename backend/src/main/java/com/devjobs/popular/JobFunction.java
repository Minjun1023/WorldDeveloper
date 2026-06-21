package com.devjobs.popular;

import java.util.List;

/**
 * 인기 공고 직무 분류. title(주 신호) ~* titleRegex 또는 tags 배열 겹침(보조)으로 매칭.
 * Postgres ~* 는 대소문자 무시 regex, \y 는 단어 경계(ml 이 html 안에 매칭되지 않도록).
 */
// title(주 신호)을 우선하고, tags 는 그 직무 '고유' 프레임워크/도구만 보조로 쓴다.
// java/aws/typescript/docker 같이 여러 직무가 공유하는 태그는 제외(노이즈 방지).
public enum JobFunction {
    BACKEND("backend", "back[ -]?end|server[ -]?side|백엔드",
        List.of("spring", "spring-boot", "django", "flask", "fastapi", "nestjs", "rails", "laravel")),
    FRONTEND("frontend", "front[ -]?end|프론트",
        List.of("react", "vue", "angular", "svelte", "next.js", "tailwind")),
    FULLSTACK("fullstack", "full[ -]?stack|풀스택",
        List.of("fullstack", "full-stack")),
    MOBILE("mobile", "\\yios\\y|android|mobile|모바일|react native|flutter",
        List.of("swift", "flutter", "swiftui", "react-native")),
    DATA_ML("data_ml", "machine learning|ml engineer|data scien|data engineer|deep learning|\\ynlp\\y|\\yllm\\y|데이터",
        List.of("pytorch", "tensorflow", "machine-learning", "nlp", "llm", "huggingface")),
    DEVOPS("devops", "devops|\\ysre\\y|site reliability|platform engineer|infrastructure engineer|cloud engineer|인프라",
        List.of("kubernetes", "terraform", "ansible", "argocd"));

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
