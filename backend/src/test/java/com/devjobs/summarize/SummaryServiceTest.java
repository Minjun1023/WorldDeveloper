package com.devjobs.summarize;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.devjobs.domain.JobEntity;
import com.devjobs.domain.JobSummaryEntity;
import com.devjobs.scout.JobRepository;
import com.devjobs.strategist.AiClient;
import com.devjobs.summarize.dto.SummaryDtos.SummaryDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class SummaryServiceTest {

    private JobSummaryRepository repo;
    private JobRepository jobRepo;
    private AiClient ai;
    private SummaryService service;

    @BeforeEach
    void setup() {
        repo = Mockito.mock(JobSummaryRepository.class);
        jobRepo = Mockito.mock(JobRepository.class);
        ai = Mockito.mock(AiClient.class);
        service = new SummaryService(repo, jobRepo, ai, new ObjectMapper());
    }

    @Test
    void cacheHit_returnsCached_noAiCall() {
        String json = "{\"responsibilities\":[\"백엔드 개발\"],\"requirements\":[],\"visa\":[],\"compensation\":[]}";
        when(repo.findByJobIdAndLang("j1", "ko"))
            .thenReturn(Optional.of(new JobSummaryEntity("j1", "ko", json, "gpt-4o-mini")));

        SummaryDto dto = service.getOrCreate("j1", "ko").orElseThrow();

        assertTrue(dto.cached());
        assertEquals(List.of("백엔드 개발"), dto.responsibilities());
        verify(ai, never()).summarize(anyString(), anyString());
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

        SummaryDto dto = service.getOrCreate("j1", "ko").orElseThrow();

        assertFalse(dto.cached());
        assertEquals(List.of("결제 시스템 개발"), dto.responsibilities());
        assertEquals(List.of("€90k"), dto.compensation());
        verify(repo).save(any(JobSummaryEntity.class));
    }

    @Test
    void aiUnavailable_throws() {
        when(repo.findByJobIdAndLang("j1", "ko")).thenReturn(Optional.empty());
        JobEntity job = Mockito.mock(JobEntity.class);
        when(job.getIsActive()).thenReturn(true);
        when(jobRepo.findById("j1")).thenReturn(Optional.of(job));
        when(ai.summarize(any(), any())).thenReturn(null);

        assertThrows(SummaryService.SummaryUnavailableException.class,
            () -> service.getOrCreate("j1", "ko"));
    }

    @Test
    void jobMissing_returnsEmpty() {
        when(repo.findByJobIdAndLang("j1", "ko")).thenReturn(Optional.empty());
        when(jobRepo.findById("j1")).thenReturn(Optional.empty());

        assertTrue(service.getOrCreate("j1", "ko").isEmpty());
    }
}
