package com.devjobs.strategist;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.devjobs.domain.JobEntity;
import com.devjobs.scout.JobRepository;
import com.devjobs.scout.JobService;
import com.devjobs.scout.dto.JobDtos.CompanyDto;
import com.devjobs.scout.dto.JobDtos.JobDto;
import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import com.devjobs.strategist.dto.RecommendDtos.RecommendResponse;
import com.devjobs.strategist.dto.RecommendDtos.RecommendationItem;
import com.devjobs.strategist.dto.RecommendDtos.ScoreBreakdown;
import java.util.List;
import java.util.Optional;
import java.util.Set;
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

    @Test
    void recommend_excludesBeforeTopK_soBackfills() {
        // topK=2. 후보 A>B>C>D(점수순). 상위 A 를 제외하면 [B, C] 로 백필되어 2개 유지돼야 한다.
        // (버그: top_k 트리밍 후 제외하면 [A,B]→A 제거→[B] 1개로 깎임)
        RecommendRequest req = new RecommendRequest(
            List.of("Java"), "senior", 5, "Backend engineer", null,
            true, List.of("Germany"), "relocation", 120000, List.of(),
            2,   // topK
            2);  // maxPerCompany

        when(aiClient.embed(anyString())).thenReturn(List.of(0.1, 0.2, 0.3));
        when(jobRepository.findSemanticCandidates(anyString(), anyInt()))
            .thenReturn(List.of(row("A"), row("B"), row("C"), row("D")));
        when(jobRepository.findSemanticRemoteViableCandidates(anyString(), anyInt()))
            .thenReturn(List.of());

        JobEntity a = ent("A");
        JobEntity b = ent("B");
        JobEntity c = ent("C");
        JobEntity d = ent("D");
        when(jobRepository.findAllById(any())).thenReturn(List.of(a, b, c, d));
        when(scorer.score(eq(a), eq(req), anyDouble())).thenReturn(sb(0.9));
        when(scorer.score(eq(b), eq(req), anyDouble())).thenReturn(sb(0.8));
        when(scorer.score(eq(c), eq(req), anyDouble())).thenReturn(sb(0.7));
        when(scorer.score(eq(d), eq(req), anyDouble())).thenReturn(sb(0.6));
        // 회사 서로 달라 다양성 제약(maxPerCompany) 영향 없음.
        when(jobService.toDto(a)).thenReturn(dto("A"));
        when(jobService.toDto(b)).thenReturn(dto("B"));
        when(jobService.toDto(c)).thenReturn(dto("C"));
        when(jobService.toDto(d)).thenReturn(dto("D"));

        RecommendResponse rec = service.recommend(req, Set.of("A"));

        assertEquals(2, rec.recommendations().size());
        assertEquals("B", rec.recommendations().get(0).job().id());
        assertEquals("C", rec.recommendations().get(1).job().id());
    }

    private static Object[] row(String id) {
        return new Object[] { id, 0.5 };
    }

    private static JobEntity ent(String id) {
        JobEntity e = mock(JobEntity.class);
        when(e.getId()).thenReturn(id);
        return e;
    }

    private static ScoreBreakdown sb(double finalScore) {
        return new ScoreBreakdown(finalScore, 0.5, 1.0, 0.5, 0.5, 0.5, 0.5, 0.0, List.of(), List.of());
    }

    private static JobDto dto(String id) {
        return new JobDto(id, id, null, new CompanyDto("co-" + id, "Co " + id, List.of()),
            null, null, null, null, null, null, null, null, null, null, null, null, null, null);
    }
}
