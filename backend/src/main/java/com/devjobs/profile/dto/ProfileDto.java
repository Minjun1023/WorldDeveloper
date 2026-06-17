package com.devjobs.profile.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public final class ProfileDto {
    private ProfileDto() {}

    public record Profile(
        List<String> skills,
        String seniority,
        @JsonProperty("years_experience") Integer yearsExperience,
        @JsonProperty("preferred_locations") List<String> preferredLocations,
        @JsonProperty("remote_preference") String remotePreference,
        @JsonProperty("desired_salary_usd") Integer desiredSalaryUsd,
        String bio,
        String handle
    ) {}

    // community_handle = 실제 표시되는 닉네임(handle 미설정 시 자동 닉네임). 항상 존재.
    public record ProfileResponse(
        boolean exists,
        Profile profile,
        @JsonProperty("community_handle") String communityHandle
    ) {}
}
