package com.devjobs.strategist;

import com.devjobs.strategist.dto.ApplicationKitDtos.ApplicationKitResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 지원 키트 생성 — 공고+이력서로 적합도/스킬갭/커버레터/면접질문(4종) + 비자 해석을 묶어 반환.
 * /api/v1/me/** 는 SecurityConfig 에서 인증 게이트됨(코치와 동일). 합성 실패 시 부분 키트 반환.
 */
@RestController
@RequestMapping("/api/v1/me/application-kit")
public class ApplicationKitController {
    private final ApplicationKitService service;
    private final RateLimiter rateLimiter;

    public ApplicationKitController(ApplicationKitService service, RateLimiter rateLimiter) {
        this.service = service;
        this.rateLimiter = rateLimiter;
    }

    public record KitRequest(String jobId, String resume) {}

    @PostMapping
    public ResponseEntity<ApplicationKitResponse> build(
            @AuthenticationPrincipal String userId, @RequestBody KitRequest req) {
        if (req.jobId() == null || req.jobId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "jobId 필요");
        }
        // 코치와 동일 게이트 + 레이트리밋 — 키트는 최대 2회 LLM 호출(skill-match + 합성)로 가장 무거운 경로.
        if (!rateLimiter.tryAcquire("kit:" + userId)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "요청이 많아요. 잠시 후 다시.");
        }
        return service.build(req.jobId(), req.resume() == null ? "" : req.resume())
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }
}
