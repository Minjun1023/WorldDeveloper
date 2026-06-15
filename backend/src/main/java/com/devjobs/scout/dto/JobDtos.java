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

    // registerVerified: 비자 근거가 정부 공식 명부(UK Home Office / US USCIS) 대조인가.
    // 키워드/추론 스폰서와 구분되는 최상위 신뢰 신호 — 프론트가 "명부 검증" 골드 마커에 사용.
    public record VisaDto(String status, List<String> evidence, boolean registerVerified) {}

    public record RemoteDto(String eligibility, List<String> evidence) {}

    public record SalaryDto(Integer minUsd, Integer maxUsd, Long min, Long max, String currency, String period) {}

    public record JobDto(
        String id,
        String title,
        String titleKo,
        CompanyDto company,
        String location,
        String locationKo,
        Boolean isRemote,
        String employmentType,
        String descriptionPreview,
        String applyUrl,
        OffsetDateTime postedAt,
        OffsetDateTime closesAt,
        List<String> tags,
        VisaDto visa,
        RemoteDto remote,
        SalaryDto salary,
        String seniority,
        OffsetDateTime firstSeenAt   // 우리가 처음 수집한 시각("최근 스크랩" 표시/정렬용)
    ) {}

    /** 단일 공고 상세 — 목록과 달리 description 전문 포함. */
    public record JobDetailDto(
        String id,
        String title,
        String titleKo,
        CompanyDto company,
        String location,
        String locationKo,
        Boolean isRemote,
        String employmentType,
        String description,
        String applyUrl,
        OffsetDateTime postedAt,
        OffsetDateTime closesAt,
        List<String> tags,
        VisaDto visa,
        RemoteDto remote,
        SalaryDto salary,
        Integer experienceYears,
        String seniority
    ) {}

    public record FacetsDto(
        Map<String, Long> visaStatus,
        Map<String, Long> isRemote,
        Map<String, Long> remoteEligibility
    ) {}

    public record JobListResponse(
        List<JobDto> items,
        int page,
        int pageSize,
        long total,
        FacetsDto facets
    ) {}

    public record RegionCount(String value, String label, long count) {}
}
