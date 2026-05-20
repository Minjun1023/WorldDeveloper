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

    private static final Map<String, Integer> ORDER = Map.of(
        "junior", 1, "mid", 2, "senior", 3, "staff", 4, "principal", 5, "unspecified", 0);

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
}
