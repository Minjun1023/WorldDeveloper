package com.devjobs.summarize;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.devjobs.domain.JobEntity;
import com.devjobs.domain.JobSummaryEntity;
import com.devjobs.scout.JobRepository;
import com.devjobs.strategist.AiClient;
import com.devjobs.strategist.RateLimiter;
import com.devjobs.summarize.dto.SummaryDtos.SummaryDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class SummaryServiceTest {

    private static final String IP = "1.2.3.4";

    private JobSummaryRepository repo;
    private JobRepository jobRepo;
    private AiClient ai;
    private RateLimiter rateLimiter;
    private com.devjobs.credits.AiCreditService credits;
    private SummaryService service;

    @BeforeEach
    void setup() {
        repo = Mockito.mock(JobSummaryRepository.class);
        jobRepo = Mockito.mock(JobRepository.class);
        ai = Mockito.mock(AiClient.class);
        rateLimiter = Mockito.mock(RateLimiter.class);
        when(rateLimiter.tryAcquire(anyString(), anyInt())).thenReturn(true);
        credits = Mockito.mock(com.devjobs.credits.AiCreditService.class);
        Mockito.when(credits.tryConsume(Mockito.any(), Mockito.anyString())).thenReturn(true);
        service = new SummaryService(repo, jobRepo, ai, new ObjectMapper(), rateLimiter, credits, 20);
    }

    @Test
    void cacheHit_returnsCached_noAiCall() {
        String json = "{\"responsibilities\":[\"백엔드 개발\"],\"requirements\":[],\"visa\":[],\"compensation\":[]}";
        when(repo.findByJobIdAndLang("j1", "ko"))
            .thenReturn(Optional.of(new JobSummaryEntity("j1", "ko", json, "gpt-4o-mini")));

        SummaryDto dto = service.getOrCreate("j1", "ko", IP).orElseThrow();

        assertTrue(dto.cached());
        assertEquals(List.of("백엔드 개발"), dto.responsibilities());
        verify(ai, never()).summarize(anyString(), anyString());
    }

    @Test
    void cacheHit_doesNotConsultRateLimiter() {
        String json = "{\"responsibilities\":[],\"requirements\":[],\"visa\":[],\"compensation\":[]}";
        when(repo.findByJobIdAndLang("j1", "ko"))
            .thenReturn(Optional.of(new JobSummaryEntity("j1", "ko", json, "gpt-4o-mini")));

        service.getOrCreate("j1", "ko", IP);

        verify(rateLimiter, never()).tryAcquire(anyString(), anyInt());
    }

    @Test
    void cacheMiss_callsAi_savesAndReturns() {
        when(repo.findByJobIdAndLang("j1", "ko")).thenReturn(Optional.empty());
        JobEntity job = Mockito.mock(JobEntity.class);
        when(job.getIsActive()).thenReturn(true);
        when(job.getTitle()).thenReturn("Backend Engineer");
        when(job.getDescriptionText()).thenReturn("We build payments.");
        when(jobRepo.findById("j1")).thenReturn(Optional.of(job));
        when(ai.summarize(anyString(), anyString())).thenReturn(new AiClient.AiSummary(
            List.of("결제 시스템 개발"), List.of("Go 3년"), List.of(), List.of("€90k"), "gpt-4o-mini"));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SummaryDto dto = service.getOrCreate("j1", "ko", IP).orElseThrow();

        assertFalse(dto.cached());
        assertEquals(List.of("결제 시스템 개발"), dto.responsibilities());
        assertEquals(List.of("€90k"), dto.compensation());
        verify(repo).save(any(JobSummaryEntity.class));
    }

    @Test
    void cacheMiss_rateLimited_throws_noAiCall() {
        when(repo.findByJobIdAndLang("j1", "ko")).thenReturn(Optional.empty());
        JobEntity job = Mockito.mock(JobEntity.class);
        when(job.getIsActive()).thenReturn(true);
        when(jobRepo.findById("j1")).thenReturn(Optional.of(job));
        when(rateLimiter.tryAcquire(anyString(), anyInt())).thenReturn(false);

        assertThrows(SummaryService.SummaryRateLimitedException.class,
            () -> service.getOrCreate("j1", "ko", IP));
        verify(ai, never()).summarize(anyString(), anyString());
    }

    @Test
    void aiUnavailable_throws() {
        when(repo.findByJobIdAndLang("j1", "ko")).thenReturn(Optional.empty());
        JobEntity job = Mockito.mock(JobEntity.class);
        when(job.getIsActive()).thenReturn(true);
        when(jobRepo.findById("j1")).thenReturn(Optional.of(job));
        when(ai.summarize(any(), any())).thenReturn(null);

        assertThrows(SummaryService.SummaryUnavailableException.class,
            () -> service.getOrCreate("j1", "ko", IP));
    }

    @Test
    void jobMissing_returnsEmpty() {
        when(repo.findByJobIdAndLang("j1", "ko")).thenReturn(Optional.empty());
        when(jobRepo.findById("j1")).thenReturn(Optional.empty());

        assertTrue(service.getOrCreate("j1", "ko", IP).isEmpty());
    }

    @Test
    void getCached_returnsCached_withoutCallingAi() {
        String json = "{\"responsibilities\":[],\"requirements\":[],\"visa\":[],\"compensation\":[]}";
        var entity = new JobSummaryEntity("greenhouse:acme:1", "ko", json, "test");
        when(repo.findByJobIdAndLang("greenhouse:acme:1", "ko")).thenReturn(Optional.of(entity));

        var result = service.getCached("greenhouse:acme:1", "ko");

        assertThat(result).isPresent();
        verifyNoInteractions(ai);
    }

    @Test
    void getCached_missing_returnsEmpty_withoutCallingAi() {
        when(repo.findByJobIdAndLang("nope", "ko")).thenReturn(Optional.empty());

        assertThat(service.getCached("nope", "ko")).isEmpty();
        verifyNoInteractions(ai);
    }
}
