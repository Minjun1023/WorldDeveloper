package com.devjobs.strategist;

import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/recommend")
public class RecommendController {

    // 공개(비인증) 엔드포인트라 임베딩(AI 비용) 경로를 보호하기 위한 입력 상한 + 레이트리밋.
    private static final int MAX_SKILLS = 50;
    private static final int MAX_BIO_LEN = 2_000;
    private static final int MAX_RESUME_LEN = 20_000;

    private final RecommendService service;
    private final RateLimiter rateLimiter;

    public RecommendController(RecommendService service, RateLimiter rateLimiter) {
        this.service = service;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping
    public ResponseEntity<?> recommend(@RequestBody RecommendRequest req, HttpServletRequest http) {
        String err = validate(req);
        if (err != null) {
            return ResponseEntity.badRequest().body(Map.of("error", err));
        }
        if (!rateLimiter.tryAcquire("recommend:" + clientKey(http))) {
            return ResponseEntity.status(429).header("Retry-After", "3600")
                .body(Map.of("error", "요청이 많습니다. 잠시 후 다시 시도하세요."));
        }
        return ResponseEntity.ok(service.recommend(req));
    }

    private static String validate(RecommendRequest req) {
        List<String> skills = req.skills();
        if (skills != null && skills.size() > MAX_SKILLS) {
            return "skills 가 너무 많습니다(최대 " + MAX_SKILLS + "개).";
        }
        if (req.bio() != null && req.bio().length() > MAX_BIO_LEN) {
            return "bio 가 너무 깁니다(최대 " + MAX_BIO_LEN + "자).";
        }
        if (req.resumeText() != null && req.resumeText().length() > MAX_RESUME_LEN) {
            return "resumeText 가 너무 깁니다(최대 " + MAX_RESUME_LEN + "자).";
        }
        return null;
    }

    private String clientKey(HttpServletRequest http) {
        // XFF 수동 파싱 금지 — 위조 가능. forward-headers-strategy 가 반영한 remoteAddr 만 사용.
        return com.devjobs.config.ClientIp.of(http);
    }
}
