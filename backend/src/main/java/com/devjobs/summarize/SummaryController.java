package com.devjobs.summarize;

import com.devjobs.summarize.SummaryService.SummaryRateLimitedException;
import com.devjobs.summarize.SummaryService.SummaryUnavailableException;
import com.devjobs.summarize.dto.SummaryDtos.SummaryDto;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
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
            return service.getOrCreate(id, lang, clientKey(http))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
        } catch (SummaryRateLimitedException e) {
            return ResponseEntity.status(429).header("Retry-After", "3600").build();
        } catch (SummaryUnavailableException e) {
            return ResponseEntity.status(503).build();
        }
    }

    private String clientKey(HttpServletRequest http) {
        String fwd = http.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) {
            return fwd.split(",")[0].trim();
        }
        return http.getRemoteAddr();
    }
}
