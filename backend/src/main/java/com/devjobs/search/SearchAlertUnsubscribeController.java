package com.devjobs.search;

import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 이메일 다이제스트 원클릭 해지 — 메일 속 링크로 호출되므로 인증 불필요(토큰이 곧 권한).
 * 토큰은 구독당 랜덤 UUID(V34)라 추측 불가. 해지는 구독 삭제가 아니라 notify=false —
 * 유저가 다시 켜고 싶을 때 검색 저장을 반복할 필요가 없다.
 */
@RestController
@RequestMapping("/api/v1/alerts")
public class SearchAlertUnsubscribeController {

    private final SavedSearchRepository repo;

    public SearchAlertUnsubscribeController(SavedSearchRepository repo) {
        this.repo = repo;
    }

    @GetMapping("/unsubscribe")
    public ResponseEntity<?> unsubscribe(@RequestParam String token) {
        UUID parsed;
        try {
            parsed = UUID.fromString(token);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid token"));
        }
        return repo.findByUnsubscribeToken(parsed)
            .map(s -> {
                s.setNotify(false);
                repo.save(s);
                return ResponseEntity.ok(Map.of("ok", true, "label", s.getLabel()));
            })
            .orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", "not found")));
    }
}
