package com.devjobs.company.dto;

import java.util.List;

public final class CompanyDtos {

    private CompanyDtos() {}

    public record CompanySummary(
        String slug,
        String displayName,
        List<String> tags,
        long jobCount
    ) {}

    public record CompanyDetail(
        String slug,
        String displayName,
        String ats,
        List<String> tags,
        String websiteUrl,
        long jobCount
    ) {}

    public record CompanyListResponse(int total, List<CompanySummary> items) {}
}
