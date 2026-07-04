package com.devjobs.company.dto;

import java.util.List;

public final class CompanyDtos {

    private CompanyDtos() {}

    public record CompanySummary(
        String slug,
        String displayName,
        List<String> tags,
        long jobCount,
        String websiteUrl,
        boolean verified,
        String location
    ) {}

    /** LCA 공시 기반 H-1B 신고 연봉(소프트웨어 직군, USD/년). 데이터 없으면 null. */
    public record H1bWage(int cases, int medianWage, Integer p25Wage, Integer p75Wage, String period) {}

    public record CompanyDetail(
        String slug,
        String displayName,
        String ats,
        List<String> tags,
        String websiteUrl,
        long jobCount,
        H1bWage h1bWage
    ) {}

    public record CompanyListResponse(int total, List<CompanySummary> items) {}
}
