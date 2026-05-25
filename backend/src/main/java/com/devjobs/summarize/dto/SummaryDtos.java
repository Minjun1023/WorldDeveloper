package com.devjobs.summarize.dto;

import java.util.List;

/** 요약 응답 DTO. Jackson SNAKE_CASE 로 jobId → job_id 변환. */
public final class SummaryDtos {

    private SummaryDtos() {}

    public record SummaryDto(
        String jobId,
        String lang,
        List<String> responsibilities,
        List<String> requirements,
        List<String> visa,
        List<String> compensation,
        String engine,
        boolean cached
    ) {}
}
