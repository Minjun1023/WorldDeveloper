package com.devjobs.strategist;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.devjobs.domain.JobEntity;
import com.devjobs.scout.JobRepository;
import com.devjobs.scout.JobService;
import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import com.devjobs.strategist.dto.RecommendDtos.RecommendationItem;
import com.devjobs.strategist.dto.RecommendDtos.ScoreBreakdown;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RecommendServiceTest {

    private JobRepository jobRepository;
    private JobService jobService;
    private JobScorer scorer;
    private AiClient aiClient;
    private RecommendService service;

    @BeforeEach
    void setUp() {
        jobRepository = mock(JobRepository.class);
        jobService    = mock(JobService.class);
        scorer        = mock(JobScorer.class);
        aiClient      = mock(AiClient.class);
        service       = new RecommendService(jobRepository, jobService, scorer, aiClient);
    }

    @Test
    void scoreOne_returnsBreakdown_forExistingJob() {
        // Arrange
        String jobId = "job-abc-123";

        RecommendRequest req = new RecommendRequest(
            List.of("Java", "Spring"),  // skills
            "senior",                   // seniority
            5,                          // yearsExperience
            "Backend engineer",         // bio
            null,                       // resumeText
            true,                       // needsVisaSponsorship
            List.of("Germany"),         // preferredLocations
            "relocation",               // remotePreference
            120000,                     // desiredSalaryUsd
            List.of(),                  // excludedCompanies
            10,                         // topK
            2                           // maxPerCompany
        );

        JobEntity job = mock(JobEntity.class);
        when(job.getId()).thenReturn(jobId);

        ScoreBreakdown expectedBreakdown = new ScoreBreakdown(
            0.82,   // finalScore
            0.9,    // stack
            1.0,    // visa
            0.7,    // location
            0.8,    // seniority
            0.6,    // salary
            0.7,    // semantic
            0.0,    // penaltyApplied
            List.of("good stack match"),  // reasons
            List.of()                     // dealBreakers
        );

        when(aiClient.embed(anyString())).thenReturn(List.of(0.1, 0.2, 0.3));
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(jobRepository.findSemanticSimilarity(anyString(), eq(jobId))).thenReturn(0.7);
        when(scorer.score(eq(job), eq(req), eq(0.7))).thenReturn(expectedBreakdown);
        when(jobService.toDto(job)).thenReturn(null);

        // Act
        RecommendationItem result = service.scoreOne(req, jobId);

        // Assert
        assertNotNull(result);
        assertEquals(0.82, result.score().finalScore(), 1e-9);
    }

    @Test
    void scoreOne_returnsNull_forMissingJob() {
        // Arrange
        RecommendRequest req = new RecommendRequest(
            null, null, null, null, null,
            null, null, null, null, null,
            10, 2
        );

        when(jobRepository.findById("nope")).thenReturn(Optional.empty());

        // Act
        RecommendationItem result = service.scoreOne(req, "nope");

        // Assert
        assertNull(result);
    }
}
