package com.devjobs.analytics;

import com.devjobs.auth.UserEntity;
import com.devjobs.auth.UserRepository;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {

    /** 익명 식별키(web 에서 sha256(ip+ua) 계산해 전달). JSON 은 SNAKE_CASE 라 anon_key. */
    public record ViewRequest(String anonKey) {}

    private final AnalyticsService analytics;
    private final UserRepository userRepo;

    public AnalyticsController(AnalyticsService analytics, UserRepository userRepo) {
        this.analytics = analytics;
        this.userRepo = userRepo;
    }

    /** 공고 조회 기록(비로그인 허용). 로그인=user_id, 익명=anon_key 로 dedup. 항상 204(실패 무시). */
    @PostMapping("/view/{jobId:.+}")
    public ResponseEntity<Void> recordView(@AuthenticationPrincipal String userId,
                                           @PathVariable String jobId,
                                           @RequestBody(required = false) ViewRequest body) {
        // permitAll 익명 요청은 principal 이 null 이 아니라 "anonymousUser" 문자열로 온다.
        UUID uid = (userId != null && !"anonymousUser".equals(userId)) ? UUID.fromString(userId) : null;
        String anon = body != null && body.anonKey() != null ? body.anonKey().trim() : "";
        if (uid == null && anon.isEmpty()) return ResponseEntity.noContent().build();
        String viewerKey = uid != null ? "u:" + uid : "a:" + anon;
        try {
            analytics.recordView(jobId, viewerKey, uid);
        } catch (Exception ignored) {  // noqa — 분석 기록 실패가 페이지를 막지 않도록
            // 무시
        }
        return ResponseEntity.noContent().build();
    }

    /** 분석 퍼널 요약(운영자 전용 — app.admin-emails 화이트리스트). */
    @GetMapping("/summary")
    public ResponseEntity<?> summary(@AuthenticationPrincipal String userId) {
        if (userId == null || "anonymousUser".equals(userId)) {
            return ResponseEntity.status(401).body(Map.of("error", "unauthorized"));
        }
        String email = userRepo.findById(UUID.fromString(userId)).map(UserEntity::getEmail).orElse(null);
        if (!analytics.isAdmin(email)) return ResponseEntity.status(403).body(Map.of("error", "forbidden"));
        return ResponseEntity.ok(analytics.summary());
    }
}
