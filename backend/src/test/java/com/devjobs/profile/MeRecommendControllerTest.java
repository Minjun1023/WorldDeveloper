package com.devjobs.profile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.devjobs.feedback.FeedbackService;
import com.devjobs.strategist.AiClient;
import com.devjobs.strategist.RateLimiter;
import com.devjobs.strategist.RecommendService;
import com.devjobs.strategist.dto.RecommendDtos.RecommendationItem;
import com.devjobs.strategist.dto.RecommendDtos.ScoreBreakdown;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MeRecommendControllerTest {

    private static final String USER_ID_STRING = UUID.randomUUID().toString();

    private ProfileService profileService;
    private RecommendService recommendService;
    private MeRecommendController controller;

    private static UserProfileEntity minimalProfile() {
        UserProfileEntity e = new UserProfileEntity(UUID.fromString(USER_ID_STRING));
        e.setSkills(List.of("java"));
        return e;
    }

    private static final UserProfileEntity PROFILE = minimalProfile();

    private static final ScoreBreakdown BREAKDOWN = new ScoreBreakdown(
        0.75,   // finalScore
        0.8,    // stack
        1.0,    // visa
        0.6,    // location
        0.7,    // seniority
        0.5,    // salary
        0.3,    // semantic
        0.0,    // penaltyApplied
        List.of("Good stack match"),  // reasons
        List.of()                     // dealBreakers
    );

    @BeforeEach
    void setUp() {
        profileService = mock(ProfileService.class);
        recommendService = mock(RecommendService.class);
        AiClient aiClient = mock(AiClient.class);
        RateLimiter rateLimiter = mock(RateLimiter.class);
        FeedbackService feedbackService = mock(FeedbackService.class);
        controller = new MeRecommendController(
            profileService, recommendService, aiClient, rateLimiter, feedbackService);
    }

    @Test
    void score_noProfile_returns409() {
        when(profileService.load(any())).thenReturn(Optional.empty());
        var resp = controller.score(USER_ID_STRING, "greenhouse:acme:1");
        assertThat(resp.getStatusCode().value()).isEqualTo(409);
    }

    @Test
    void score_missingJob_returns404() {
        when(profileService.load(any())).thenReturn(Optional.of(PROFILE));
        when(recommendService.scoreOne(any(), eq("nope"))).thenReturn(null);
        var resp = controller.score(USER_ID_STRING, "nope");
        assertThat(resp.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void score_ok_returns200() {
        when(profileService.load(any())).thenReturn(Optional.of(PROFILE));
        when(recommendService.scoreOne(any(), eq("greenhouse:acme:1")))
            .thenReturn(new RecommendationItem(null, BREAKDOWN));
        var resp = controller.score(USER_ID_STRING, "greenhouse:acme:1");
        assertThat(resp.getStatusCode().value()).isEqualTo(200);
    }
}
