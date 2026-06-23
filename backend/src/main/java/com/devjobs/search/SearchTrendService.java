package com.devjobs.search;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 인기 검색어: 검색 실행을 정규화해 기록(search_queries)하고, 최근 N일 상위 검색어를 집계한다.
 * job_views → PopularJob 과 동일한 토대. 콜드스타트(데이터 부족) 시엔 빈 목록을 주고, 큐레이션
 * 기본값 fallback 은 프런트(히어로)에서 채운다.
 */
@Service
public class SearchTrendService {

    private static final int WINDOW_DAYS = 7;
    // 1회성 잡음 제거: 서로 다른 검색자 기준 최소 카운트. 데이터가 쌓이기 전엔 자연히 빈 목록 → fallback.
    private static final int MIN_COUNT = 2;
    private static final int MIN_LEN = 2;
    private static final int MAX_LEN = 40;

    private final SearchQueryRepository repo;

    public SearchTrendService(SearchQueryRepository repo) {
        this.repo = repo;
    }

    /** 검색어 정규화: 소문자·trim·공백 단일화. 부적합(너무 짧/긺, 빈값)이면 null → 기록 생략. */
    static String normalize(String raw) {
        if (raw == null) return null;
        String t = raw.strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
        if (t.length() < MIN_LEN || t.length() > MAX_LEN) return null;
        // 최소 1개의 글자/숫자를 포함(순수 기호/구두점 검색어 제외).
        if (!t.matches(".*[\\p{L}\\p{N}].*")) return null;
        return t;
    }

    /** 검색 1건 기록(비로그인 허용). 실패해도 검색 동작에 영향 없도록 호출부에서 무시. */
    @Transactional
    public void record(String rawTerm, String searcherKey, UUID userId) {
        String term = normalize(rawTerm);
        if (term == null || searcherKey == null || searcherKey.isBlank()) return;
        repo.record(term, searcherKey, userId);
    }

    /** 최근 7일 인기 검색어(상위 limit). 임계값 미만이면 비어 있을 수 있다(콜드스타트). */
    @Transactional(readOnly = true)
    public List<String> popular(int limit) {
        int lim = Math.min(Math.max(limit, 1), 12);
        return repo.topTermsSince(WINDOW_DAYS, MIN_COUNT, lim).stream()
            .map(r -> (String) r[0])
            .toList();
    }
}
