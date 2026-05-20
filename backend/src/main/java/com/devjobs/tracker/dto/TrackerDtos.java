package com.devjobs.tracker.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public final class TrackerDtos {

    private TrackerDtos() {}

    public record TrackRequest(String jobId, String status, String notes) {}

    public record PatchRequest(String status, String notes) {}

    public record ApplicationDto(
        String jobId,
        String status,
        String notes,
        OffsetDateTime updatedAt,
        String jobTitle,
        String companyName
    ) {}

    public record PipelineSummary(
        long total,
        Map<String, Long> byStatus
    ) {}

    public record ApplicationListResponse(int total, List<ApplicationDto> items) {}
}
