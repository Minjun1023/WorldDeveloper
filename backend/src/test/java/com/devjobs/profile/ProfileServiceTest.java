package com.devjobs.profile;

import static org.assertj.core.api.Assertions.assertThat;

import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ProfileServiceTest {

    private UserProfileEntity profile() {
        UserProfileEntity e = new UserProfileEntity(UUID.randomUUID());
        e.setSkills(List.of("python", "django"));
        e.setSeniority("senior");
        e.setYearsExperience(5);
        e.setPreferredLocations(List.of("germany"));
        e.setRemotePreference("any");
        e.setDesiredSalaryUsd(90000);
        return e;
    }

    @Test
    void buildsRequestWithVisaAlwaysTrue() {
        RecommendRequest r = ProfileService.toRecommendRequest(profile(), null);
        assertThat(r.needsVisaSponsorship()).isTrue();
        assertThat(r.skills()).containsExactly("python", "django");
        assertThat(r.preferredLocations()).containsExactly("germany");
        assertThat(r.topK()).isEqualTo(9);
    }

    @org.junit.jupiter.api.Test
    void passesBioIntoRecommendRequest() {
        UserProfileEntity e = profile();
        e.setBio("backend engineer who loves distributed systems");
        RecommendRequest r = ProfileService.toRecommendRequest(e, null);
        assertThat(r.bio()).isEqualTo("backend engineer who loves distributed systems");
    }

    @Test
    void passesTopKThroughAndClamps() {
        assertThat(ProfileService.toRecommendRequest(profile(), null, 20).topK()).isEqualTo(20);
        assertThat(ProfileService.toRecommendRequest(profile(), null, 100).topK()).isEqualTo(30); // 상한
        assertThat(ProfileService.toRecommendRequest(profile(), null, 0).topK()).isEqualTo(1); // 하한
    }

    @Test
    void mergesNoteSkillsAndLocations() {
        var note = new com.devjobs.strategist.AiClient.ParseResult.Profile(
            List.of("go", "python"), null, null, true, List.of("netherlands"), null, null);
        RecommendRequest r = ProfileService.toRecommendRequest(profile(), note);
        assertThat(r.skills()).contains("python", "django", "go");
        assertThat(r.preferredLocations()).contains("germany", "netherlands");
        assertThat(r.needsVisaSponsorship()).isTrue();
    }
}
