package com.devjobs.strategist.dto;

import com.devjobs.scout.dto.JobDtos.JobDto;
import java.util.List;

/** 추천 요청/응답 DTO (DESIGN.md 5.1 POST /recommend). */
public final class RecommendDtos {

    private RecommendDtos() {}

    public record RecommendRequest(
        List<String> skills,
        String seniority,
        Integer yearsExperience,
        String bio,
        String resumeText,
        Boolean needsVisaSponsorship,
        List<String> preferredLocations,
        String remotePreference,
        Integer desiredSalaryUsd,
        List<String> excludedCompanies,
        Integer topK,
        Integer maxPerCompany
    ) {}

    public record ScoreBreakdown(
        double finalScore,
        double stack,
        double visa,
        double location,
        double seniority,
        double salary,
        double semantic,
        double penaltyApplied,
        List<String> reasons,
        List<String> dealBreakers
    ) {}

    public record RecommendationItem(JobDto job, ScoreBreakdown score) {}

    public record RecommendResponse(
        int totalCandidates,
        int returned,
        List<RecommendationItem> recommendations
    ) {}
}
