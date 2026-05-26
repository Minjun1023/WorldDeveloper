package com.devjobs.scout.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * GET /api/v1/jobs 응답 DTO 모음 (DESIGN.md 5.1).
 * Jackson SNAKE_CASE 전략으로 isRemote → is_remote 등 자동 변환.
 */
public final class JobDtos {

    private JobDtos() {}

    public record CompanyDto(String slug, String displayName, List<String> tags) {}

    public record VisaDto(String status, List<String> evidence) {}

    public record SalaryDto(Integer minUsd, Integer maxUsd) {}

    public record JobDto(
        String id,
        String title,
        CompanyDto company,
        String location,
        Boolean isRemote,
        String employmentType,
        String descriptionPreview,
        String applyUrl,
        OffsetDateTime postedAt,
        OffsetDateTime closesAt,
        List<String> tags,
        VisaDto visa,
        SalaryDto salary
    ) {}

    /** 단일 공고 상세 — 목록과 달리 description 전문 포함. */
    public record JobDetailDto(
        String id,
        String title,
        CompanyDto company,
        String location,
        Boolean isRemote,
        String employmentType,
        String description,
        String applyUrl,
        OffsetDateTime postedAt,
        OffsetDateTime closesAt,
        List<String> tags,
        VisaDto visa,
        SalaryDto salary
    ) {}

    public record FacetsDto(
        Map<String, Long> visaStatus,
        Map<String, Long> isRemote
    ) {}

    public record JobListResponse(
        List<JobDto> items,
        int page,
        int pageSize,
        long total,
        FacetsDto facets
    ) {}

    public record CountryCount(String value, String label, long count) {}
}
