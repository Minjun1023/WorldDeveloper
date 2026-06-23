package com.devjobs.search;

import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 인기 검색어: 검색 실행 기록(비로그인 허용) + 최근 7일 상위 검색어 조회(공개). */
@RestController
@RequestMapping("/api/v1/search")
public class SearchTrendController {

    /** 검색 1건 기록 요청. JSON 은 SNAKE_CASE 라 anon_key. */
    public record LogRequest(String term, String anonKey) {}

    private final SearchTrendService trends;

    public SearchTrendController(SearchTrendService trends) {
        this.trends = trends;
    }

    /** 검색 실행 기록(비로그인 허용). 로그인=user_id, 익명=anon_key 로 dedup. 항상 204(실패 무시). */
    @PostMapping("/log")
    public ResponseEntity<Void> log(@AuthenticationPrincipal String userId,
                                    @RequestBody(required = false) LogRequest body) {
        if (body == null || body.term() == null) return ResponseEntity.noContent().build();
        // permitAll 익명 요청은 principal 이 null 이 아니라 "anonymousUser" 문자열로 온다.
        UUID uid = (userId != null && !"anonymousUser".equals(userId)) ? UUID.fromString(userId) : null;
        String anon = body.anonKey() != null ? body.anonKey().trim() : "";
        if (uid == null && anon.isEmpty()) return ResponseEntity.noContent().build();
        String searcherKey = uid != null ? "u:" + uid : "a:" + anon;
        try {
            trends.record(body.term(), searcherKey, uid);
        } catch (Exception ignored) {  // noqa — 기록 실패가 검색을 막지 않도록
            // 무시
        }
        return ResponseEntity.noContent().build();
    }

    /** 최근 7일 인기 검색어(공개). 데이터 부족 시 빈 목록 → 프런트가 큐레이션 기본값으로 fallback. */
    @GetMapping("/popular")
    public List<String> popular(@RequestParam(defaultValue = "8") int limit) {
        return trends.popular(limit);
    }
}
