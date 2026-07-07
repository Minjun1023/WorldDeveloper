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
    // evidenceTier: sponsors 근거 등급(register/direct/indirect) — 목록 응답이 evidence 배열을
    // 생략해도(페이로드 절감) 프론트가 근거 강도를 구분해 표기할 수 있게 서버가 계산해 내려준다.
    public record VisaDto(String status, List<String> evidence, boolean registerVerified,
                          String evidenceTier) {}

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
        // 마감(비활성/기한 경과) 여부 — 검색 결과는 항상 false(live 만 노출),
        // 저장 목록(byIdsIncludingClosed)에서만 true 가 실린다. 칸반 "마감됨" 배지용.
        Boolean closed
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
        String department,
        Boolean relocationSupport,
        String languageRequirement,
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

    /** 회사 페이지 통계 — 전체(필터된) 공고 집계. 페이지 슬라이스와 무관하게 항상 전체 기준. */
    public record CompanyJobStats(Integer sponsorRatio, int verifiedCount, int remoteCount) {}

    /** 회사별 공고 — 페이지네이션된 목록 + 전체 집계 통계(통계는 모든 공고 기준). */
    public record CompanyJobsResponse(
        List<JobDto> items,
        int page,
        int pageSize,
        int total,
        CompanyJobStats stats
    ) {}
}
