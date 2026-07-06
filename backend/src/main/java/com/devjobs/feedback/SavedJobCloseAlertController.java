package com.devjobs.feedback;

import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 저장 공고 마감 알림 설정 — FavoriteCompanyAlertController 와 동일 패턴.
 * - GET/PUT /api/v1/me/saved-job-alerts : 알림 on/off (행 없으면 생성)
 * - GET /api/v1/alerts/unsubscribe-saved : 메일 원클릭 해지(토큰이 곧 권한)
 */
@RestController
public class SavedJobCloseAlertController {

    private final SavedJobCloseAlertRepository repo;

    public SavedJobCloseAlertController(SavedJobCloseAlertRepository repo) {
        this.repo = repo;
    }

    @GetMapping("/api/v1/me/saved-job-alerts")
    public Map<String, Boolean> get(@AuthenticationPrincipal String userId) {
        boolean notify = repo.findById(UUID.fromString(userId))
            .map(SavedJobCloseAlertEntity::isNotify)
            .orElse(true); // 행 미생성 = 기본 켬(첫 저장 시 자동 생성되는 기본값과 동일)
        return Map.of("notify", notify);
    }

    public record UpdateRequest(boolean enabled) {}

    @PutMapping("/api/v1/me/saved-job-alerts")
    public Map<String, Boolean> update(@AuthenticationPrincipal String userId, @RequestBody UpdateRequest req) {
        UUID uid = UUID.fromString(userId);
        SavedJobCloseAlertEntity s = repo.findById(uid).orElseGet(() -> new SavedJobCloseAlertEntity(uid));
        s.setNotify(req.enabled());
        repo.save(s);
        return Map.of("notify", s.isNotify());
    }

    @GetMapping("/api/v1/alerts/unsubscribe-saved")
    public ResponseEntity<?> unsubscribe(@RequestParam String token) {
        UUID parsed;
        try {
            parsed = UUID.fromString(token);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid token"));
        }
        return repo.findByUnsubscribeToken(parsed)
            .<ResponseEntity<?>>map(s -> {
                s.setNotify(false);
                repo.save(s);
                return ResponseEntity.ok(Map.of("ok", true));
            })
            .orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", "not found")));
    }
}
