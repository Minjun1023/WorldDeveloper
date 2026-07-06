package com.devjobs.company;

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
 * 관심 기업 새 공고 알림 설정.
 * - GET/PUT /api/v1/me/company-alerts : 알림 on/off 조회·변경 (행이 없으면 생성 — 관심기업 추가
 *   전에 설정 화면을 먼저 열어도 동작).
 * - GET /api/v1/alerts/unsubscribe-company : 메일 원클릭 해지(토큰이 곧 권한, 인증 불필요) —
 *   SearchAlertUnsubscribeController 와 동일 패턴.
 */
@RestController
public class FavoriteCompanyAlertController {

    private final FavoriteCompanyAlertRepository repo;

    public FavoriteCompanyAlertController(FavoriteCompanyAlertRepository repo) {
        this.repo = repo;
    }

    @GetMapping("/api/v1/me/company-alerts")
    public Map<String, Boolean> get(@AuthenticationPrincipal String userId) {
        boolean notify = repo.findById(UUID.fromString(userId))
            .map(FavoriteCompanyAlertEntity::isNotify)
            .orElse(true); // 행 미생성 = 기본 켬(관심기업 추가 시 자동 생성되는 기본값과 동일)
        return Map.of("notify", notify);
    }

    // 컴포넌트명 'notify' 는 Object.notify() 와 충돌해 record 에 쓸 수 없다 → enabled.
    public record UpdateRequest(boolean enabled) {}

    @PutMapping("/api/v1/me/company-alerts")
    public Map<String, Boolean> update(@AuthenticationPrincipal String userId, @RequestBody UpdateRequest req) {
        UUID uid = UUID.fromString(userId);
        FavoriteCompanyAlertEntity s = repo.findById(uid).orElseGet(() -> new FavoriteCompanyAlertEntity(uid));
        s.setNotify(req.enabled());
        repo.save(s);
        return Map.of("notify", s.isNotify());
    }

    @GetMapping("/api/v1/alerts/unsubscribe-company")
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
