package com.devjobs.profile;

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
 * 프로필 매칭 알림 설정 — FavoriteCompanyAlertController 와 동일 패턴.
 * 기본 꺼짐(옵트인): 행이 없으면 notify=false 로 응답한다.
 * - GET/PUT /api/v1/me/match-alerts
 * - GET /api/v1/alerts/unsubscribe-match (토큰이 곧 권한)
 */
@RestController
public class ProfileMatchAlertController {

    private final ProfileMatchAlertRepository repo;

    public ProfileMatchAlertController(ProfileMatchAlertRepository repo) {
        this.repo = repo;
    }

    @GetMapping("/api/v1/me/match-alerts")
    public Map<String, Boolean> get(@AuthenticationPrincipal String userId) {
        boolean notify = repo.findById(UUID.fromString(userId))
            .map(ProfileMatchAlertEntity::isNotify)
            .orElse(false); // 옵트인 — 행 미생성 = 꺼짐
        return Map.of("notify", notify);
    }

    public record UpdateRequest(boolean enabled) {}

    @PutMapping("/api/v1/me/match-alerts")
    public Map<String, Boolean> update(@AuthenticationPrincipal String userId, @RequestBody UpdateRequest req) {
        UUID uid = UUID.fromString(userId);
        ProfileMatchAlertEntity s = repo.findById(uid)
            .orElseGet(() -> new ProfileMatchAlertEntity(uid, req.enabled()));
        s.setNotify(req.enabled());
        repo.save(s);
        return Map.of("notify", s.isNotify());
    }

    @GetMapping("/api/v1/alerts/unsubscribe-match")
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
