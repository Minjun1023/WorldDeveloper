package com.devjobs.scout;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 공고 위치 문자열 → 한국어 표시용 결정적(deterministic) 로컬라이저.
 *
 * <p>일본 ATS(lever/hrmos 등)의 위치는 우편번호 + 전체 주소 + 빌딩명까지 일본어로 길게 온다
 * (예: "106-6113 東京都港区六本木6-10-1 六本木ヒルズ森タワー13F"). 구직자에게 필요한 건 도시·국가
 * 정도라, 알려진 일본 도시/도도부현 한자를 한국어 도시명으로 매핑하고 "{도시}, 일본"으로 축약한다.
 *
 * <p>기계번역을 쓰지 않는다 — 주소/고유명사는 MT 가 오히려 망가뜨린다(TitleLocalizer 와 동일 철학).
 * 매핑 대상이 아닌 위치(일반 영어 등)는 null 을 반환해 호출부가 원본 location 을 그대로 쓰게 한다.
 * 검색/지역 필터는 원본 location 으로 동작하므로(이 값은 표시 전용) 영향 없다.
 */
public final class LocationLocalizer {

    private LocationLocalizer() {}

    private static final String JAPAN = "일본";

    // 한자 도시/도도부현 → 한국어 도시명. 순서 중요: "東京都"는 "京都"를 포함하므로 東京 을 먼저 검사한다.
    private static final Map<String, String> JP_CITIES = new LinkedHashMap<>();
    static {
        JP_CITIES.put("東京", "도쿄");
        JP_CITIES.put("大阪", "오사카");
        JP_CITIES.put("横浜", "요코하마");   // 神奈川県보다 도시명을 우선
        JP_CITIES.put("京都", "교토");
        JP_CITIES.put("名古屋", "나고야");
        JP_CITIES.put("福岡", "후쿠오카");
        JP_CITIES.put("札幌", "삿포로");
        JP_CITIES.put("神戸", "고베");
        JP_CITIES.put("仙台", "센다이");
        JP_CITIES.put("広島", "히로시마");
        JP_CITIES.put("千葉", "지바");
        JP_CITIES.put("埼玉", "사이타마");
        JP_CITIES.put("神奈川", "가나가와");
        JP_CITIES.put("沖縄", "오키나와");
    }

    // 영어로 온 일본 도시 — 가독성 위해 한국어로 통일.
    private static final Map<String, String> EN_JP_CITIES = new LinkedHashMap<>();
    static {
        EN_JP_CITIES.put("tokyo", "도쿄");
        EN_JP_CITIES.put("osaka", "오사카");
        EN_JP_CITIES.put("yokohama", "요코하마");
        EN_JP_CITIES.put("kyoto", "교토");
        EN_JP_CITIES.put("nagoya", "나고야");
        EN_JP_CITIES.put("fukuoka", "후쿠오카");
    }

    // 가나(히라가나/가타카나) 또는 한자.
    private static final Pattern JP_CHARS = Pattern.compile("[\\u3040-\\u30FF\\u4E00-\\u9FAF]");

    /** 위치를 한국어 표시용("{도시}, 일본")으로. 대상 아님이면 null(원본 표시). */
    public static String localize(String location) {
        if (location == null || location.isBlank()) return null;

        if (JP_CHARS.matcher(location).find()) {
            for (Map.Entry<String, String> e : JP_CITIES.entrySet()) {
                if (location.contains(e.getKey())) return e.getValue() + ", " + JAPAN;
            }
            // 도시 미상이지만 일본어 주소 — 최소한 국가로.
            return JAPAN;
        }

        // 영어로 온 일본 도시도 한국어로 통일("Tokyo, Japan" → "도쿄, 일본").
        String low = location.toLowerCase();
        for (Map.Entry<String, String> e : EN_JP_CITIES.entrySet()) {
            if (low.contains(e.getKey())) return e.getValue() + ", " + JAPAN;
        }
        if (low.contains("japan")) return JAPAN;

        // 일본 외 위치 — 로컬라이즈 대상 아님. 원본 유지.
        return null;
    }
}
