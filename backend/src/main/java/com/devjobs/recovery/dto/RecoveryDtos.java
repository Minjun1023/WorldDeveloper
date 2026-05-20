package com.devjobs.recovery.dto;

import java.util.List;
import java.util.Map;

/**
 * 거절 회복 키트 응답 (rejection_recovery.py 포팅).
 * Jackson SNAKE_CASE 로 rejectedJobId → rejected_job_id 등 변환.
 */
public final class RecoveryDtos {

    private RecoveryDtos() {}

    public record RecoveryRequest(String reason, Boolean markRejected) {}

    public record SimilarCompany(String slug, String displayName, long jobCount) {}

    public record RecoveryStats(
        long totalApplications,
        long rejectedCount,
        double rejectionRate,
        Map<String, Long> stageBreakdown
    ) {}

    public record RecoveryResponse(
        String rejectedJobId,
        String jobTitle,
        String company,
        String reasonLogged,
        boolean trackerUpdated,
        List<String> sharedTags,
        List<SimilarCompany> similarCompanies,
        RecoveryStats stats,
        List<String> nextActions,
        String encouragement
    ) {}
}
