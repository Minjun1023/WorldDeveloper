package com.devjobs.strategist;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** 공고 제목에서 시니어리티 추출 + 사용자 레벨과의 적합도 (seniority.py 포팅). */
final class Seniority {

    private Seniority() {}

    private record Level(String name, List<Pattern> patterns) {}

    // 로마숫자 등급(Engineer II/III/IV)은 표준적이라 추가로 인식한다. 회사마다 제각각인
    // 아라비아 숫자("Engineer 3")·"L4" 는 노이즈가 커서 의도적으로 제외하고, 그런 공고는
    // 아래 detect 의 경력연수(experience_years) 추론으로 레벨을 채운다.
    private static final List<Level> LEVELS = List.of(
        new Level("principal", List.of(p("\\bprincipal\\b"), p("\\bdistinguished\\b"), p("\\bfellow\\b"))),
        new Level("staff", List.of(p("\\bstaff\\b"), p("\\bIV\\b"))),
        new Level("senior", List.of(p("\\bsenior\\b"), p("\\bsr\\.?\\b"), p("\\blead\\b(?!\\s+to)"),
            p("\\bIII\\b"))),
        new Level("mid", List.of(p("\\bmid[-\\s]?(?:level)?\\b"), p("\\bintermediate\\b"), p("\\bII\\b"))),
        new Level("junior", List.of(p("\\bjunior\\b"), p("\\bjr\\.?\\b"), p("\\bentry[-\\s]?level\\b"),
            p("\\bnew\\s+grad\\b"), p("\\bgraduate\\b"), p("\\bintern\\b")))
    );

    // "entry"(신입/취준생)는 junior 와 같은 레벨로 본다 — entry-level/new-grad 공고가 junior 로 감지되므로.
    private static final Map<String, Integer> ORDER = Map.of(
        "entry", 1, "junior", 1, "mid", 2, "senior", 3, "staff", 4, "principal", 5, "unspecified", 0);

    private static Pattern p(String re) {
        return Pattern.compile(re, Pattern.CASE_INSENSITIVE);
    }

    static String detect(String title, String description, Integer experienceYears) {
        String text = title == null ? "" : title;
        for (Level lv : LEVELS) {
            for (Pattern pat : lv.patterns()) {
                if (pat.matcher(text).find()) return lv.name();
            }
        }
        String head = description == null ? "" : description.substring(0, Math.min(500, description.length()));
        for (Level lv : LEVELS) {
            for (Pattern pat : lv.patterns()) {
                if (pat.matcher(head).find()) return lv.name();
            }
        }
        // 제목·본문에 레벨 단어가 없으면(보드의 ~43%) 요구 경력연수로 추론한다.
        // 예: '보안 엔지니어'(레벨 단어 없음)라도 8년+ 요구면 사실상 스태프급 → 신입에겐 over-level.
        // 이게 없으면 fit/over-level 패널티가 절반 공고에 무력했다.
        return fromExperienceYears(experienceYears);
    }

    /** 요구 경력연수 → 레벨. 키워드 추출 실패 시의 폴백. null 이면 정보없음. */
    static String fromExperienceYears(Integer years) {
        if (years == null) return "unspecified";
        if (years >= 8) return "staff";
        if (years >= 5) return "senior";
        if (years >= 3) return "mid";
        return "junior"; // 0~2년 (entry 와 동급 레벨)
    }

    /** 0~1 적합도. 일치 1.0 / 1단계 0.6 / 2단계 0.3 / 정보없음 0.5. */
    static double fit(String userLevel, String jobLevel) {
        int u = ORDER.getOrDefault(userLevel == null ? "" : userLevel.toLowerCase(), 0);
        int j = ORDER.getOrDefault(jobLevel == null ? "" : jobLevel.toLowerCase(), 0);
        if (u == 0 || j == 0) return 0.5;
        int diff = Math.abs(u - j);
        return switch (diff) {
            case 0 -> 1.0;
            case 1 -> 0.6;
            case 2 -> 0.3;
            default -> 0.1;
        };
    }

    /**
     * 공고가 사용자보다 많이 높은 직급(over-leveled)이면 곱하기 패널티 배수.
     * 레벨 가중치(0.10)만으로는 신입이 스태프/프린시플 공고를 1순위로 보는 걸 못 막아서,
     * 비현실적 지원(2단계↑ 상위)을 deal-breaker 처럼 눌러준다. 동급·1단계·하위는 패널티 없음(1.0).
     * 레벨 정보 없으면 패널티 없음.
     */
    static double overLevelPenalty(String userLevel, String jobLevel) {
        int u = ORDER.getOrDefault(userLevel == null ? "" : userLevel.toLowerCase(), 0);
        int j = ORDER.getOrDefault(jobLevel == null ? "" : jobLevel.toLowerCase(), 0);
        if (u == 0 || j == 0) return 1.0;
        int over = j - u; // 양수 = 공고가 더 높은 직급
        if (over >= 3) return 0.3;  // 신입/주니어 → 스태프/프린시플 등 (비현실적)
        if (over == 2) return 0.6;  // 신입 → 시니어, 미들 → 스태프 등 (큰 도전)
        return 1.0;
    }
}
