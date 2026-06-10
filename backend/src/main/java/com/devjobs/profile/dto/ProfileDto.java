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
        String bio
    ) {}

    public record ProfileResponse(boolean exists, Profile profile) {}
}
