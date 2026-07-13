package com.devjobs.summarize;

import com.devjobs.summarize.SummaryService.SummaryRateLimitedException;
import com.devjobs.summarize.SummaryService.SummaryUnavailableException;
import com.devjobs.summarize.dto.SummaryDtos.SummaryDto;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 공고 요약 — 인증 불필요. 캐시 우선, 미스 시 AI. id 는 콜론 포함이라 {id:.+}. */
@RestController
@RequestMapping("/api/v1/jobs/{id:.+}")
public class SummaryController {

    private final SummaryService service;

    public SummaryController(SummaryService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    public ResponseEntity<SummaryDto> summary(
        @AuthenticationPrincipal String principal,
        @PathVariable String id,
        @RequestParam(defaultValue = "ko") String lang,
        @RequestParam(defaultValue = "false") boolean cacheOnly,
        HttpServletRequest http) {
        if (cacheOnly) {
            return service.getCached(id, lang)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
        }
        try {
            return service.getOrCreate(id, lang, clientKey(http), viewer(principal))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
        } catch (SummaryRateLimitedException e) {
            return ResponseEntity.status(429).header("Retry-After", "3600").build();
        } catch (SummaryUnavailableException e) {
            return ResponseEntity.status(503).build();
        }
    }

    private String clientKey(HttpServletRequest http) {
        // XFF 수동 파싱 금지 — 위조 가능. forward-headers-strategy 가 반영한 remoteAddr 만 사용.
        return com.devjobs.config.ClientIp.of(http);
    }

    /** 공개 엔드포인트의 옵션 로그인 — 익명이면 null (CommunityController viewer 패턴). */
    private UUID viewer(String principal) {
        if (principal == null || "anonymousUser".equals(principal)) return null;
        try {
            return UUID.fromString(principal);
        } catch (Exception e) {
            return null;
        }
    }
}
