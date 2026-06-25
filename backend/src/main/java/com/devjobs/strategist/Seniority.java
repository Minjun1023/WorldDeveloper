package com.devjobs.strategist;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** 공고 제목에서 시니어리티 추출 + 사용자 레벨과의 적합도 (seniority.py 포팅). */
final class Seniority {

    private Seniority() {}

    private record Level(String name, List<Pattern> patterns) {}

    private static final List<Level> LEVELS = List.of(
        new Level("principal", List.of(p("\\bprincipal\\b"), p("\\bdistinguished\\b"), p("\\bfellow\\b"))),
        new Level("staff", List.of(p("\\bstaff\\b"))),
        new Level("senior", List.of(p("\\bsenior\\b"), p("\\bsr\\.?\\b"), p("\\blead\\b(?!\\s+to)"))),
        new Level("mid", List.of(p("\\bmid[-\\s]?(?:level)?\\b"), p("\\bintermediate\\b"))),
        new Level("junior", List.of(p("\\bjunior\\b"), p("\\bjr\\.?\\b"), p("\\bentry[-\\s]?level\\b"),
            p("\\bnew\\s+grad\\b"), p("\\bgraduate\\b"), p("\\bintern\\b")))
    );

    // "entry"(신입/취준생)는 junior 와 같은 레벨로 본다 — entry-level/new-grad 공고가 junior 로 감지되므로.
    private static final Map<String, Integer> ORDER = Map.of(
        "entry", 1, "junior", 1, "mid", 2, "senior", 3, "staff", 4, "principal", 5, "unspecified", 0);

    private static Pattern p(String re) {
        return Pattern.compile(re, Pattern.CASE_INSENSITIVE);
    }

    static String detect(String title, String description) {
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
        return "unspecified";
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
