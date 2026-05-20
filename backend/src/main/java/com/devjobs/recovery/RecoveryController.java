package com.devjobs.recovery;

import com.devjobs.recovery.dto.RecoveryDtos.RecoveryRequest;
import com.devjobs.recovery.dto.RecoveryDtos.RecoveryResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 거절 회복 — 인증 필요 (/applications/** 는 SecurityConfig 에서 authenticated).
 * 추적 중인 공고만 회복 키트를 만들 수 있다(없으면 404).
 */
@RestController
@RequestMapping("/api/v1/applications")
public class RecoveryController {

    private final RecoveryService service;

    public RecoveryController(RecoveryService service) {
        this.service = service;
    }

    @PostMapping("/{jobId}/recovery")
    public ResponseEntity<RecoveryResponse> recover(
        @AuthenticationPrincipal String userId,
        @PathVariable String jobId,
        @RequestBody(required = false) RecoveryRequest req) {

        String reason = req == null ? null : req.reason();
        boolean markRejected = req == null || req.markRejected() == null || req.markRejected();

        return service.recover(userId, jobId, reason, markRejected)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
