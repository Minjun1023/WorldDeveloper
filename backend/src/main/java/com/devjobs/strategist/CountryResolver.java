package com.devjobs.strategist;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 공고 location 문자열 → 비자 가이드 지원 5개국 ISO2(us/gb/de/nl/ca) 추론.
 * 불명확하면 null → 가이드 생략(규칙 판정만). ai/scripts/gen_company_locations.py 부분집합 포팅.
 * uk 는 부분문자열 오인(Milwaukee 등) 회피 위해 도시명/경계 토큰만 사용한다.
 */
public final class CountryResolver {
    private CountryResolver() {}

    // 순서 중요: 먼저 매칭되는 규칙 채택. 키워드는 모두 소문자.
    private static final List<Map.Entry<String, List<String>>> RULES = List.of(
        Map.entry("gb", List.of("united kingdom", ", uk", "(uk", "london", "manchester",
            "england", "scotland", "edinburgh", "cambridge", "bristol")),
        Map.entry("de", List.of("germany", "deutschland", "berlin", "munich", "münchen",
            "hamburg", "frankfurt", "cologne", "köln", "stuttgart")),
        Map.entry("nl", List.of("netherlands", "amsterdam", "rotterdam", "the hague", "den haag",
            "utrecht", "eindhoven", "holland")),
        Map.entry("ca", List.of("canada", "toronto", "vancouver", "montreal", "ottawa",
            "ontario", "british columbia", "waterloo")),
        Map.entry("us", List.of("united states", "usa", "u.s.", "new york", "san francisco",
            "california", "seattle", "austin", "boston", "chicago", "denver", "atlanta",
            ", ny", ", ca", ", wa", ", tx", ", ma"))
    );

    /** location 에서 지원 국가 ISO2 추론. 없으면 null. */
    public static String resolve(String location) {
        if (location == null || location.isBlank()) {
            return null;
        }
        String loc = location.toLowerCase(Locale.ROOT);
        for (var rule : RULES) {
            for (String kw : rule.getValue()) {
                if (loc.contains(kw)) {
                    return rule.getKey();
                }
            }
        }
        return null;
    }
}
