package com.devjobs.strategist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.devjobs.scout.JobService;
import com.devjobs.scout.dto.JobDtos.CompanyDto;
import com.devjobs.scout.dto.JobDtos.JobDetailDto;
import com.devjobs.strategist.dto.VisaGuideDtos.VisaGuideResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class VisaGuideQueryServiceTest {

    private JobService jobService;
    private VisaCountryGuideRepository repo;
    private VisaGuideQueryService service;

    @BeforeEach
    void setUp() {
        jobService = mock(JobService.class);
        repo = mock(VisaCountryGuideRepository.class);
        com.fasterxml.jackson.databind.ObjectMapper m = new com.fasterxml.jackson.databind.ObjectMapper();
        m.setPropertyNamingStrategy(com.fasterxml.jackson.databind.PropertyNamingStrategies.SNAKE_CASE);
        service = new VisaGuideQueryService(jobService, repo, m);
    }

    private static JobDetailDto job(String location) {
        return new JobDetailDto("j1", "Backend Engineer", null,
            new CompanyDto("acme", "Acme", List.of()),
            location, null, false, "full_time",
            "JD", null, null, null, List.of(), null, null, null, null, "senior");
    }

    private static VisaCountryGuide guideRow() {
        VisaCountryGuide g = mock(VisaCountryGuide.class);
        when(g.getGuideText()).thenReturn("독일 Blue Card 경로");
        when(g.getSources()).thenReturn(
            "[{\"title\":\"취업비자\",\"url\":\"https://make-it-in-germany.com\",\"retrieved_at\":\"2026-06-25\"}]");
        when(g.getDisclaimer()).thenReturn("법률·이민 자문이 아닙니다. 2026-06-25 기준 ... 공식 확인");
        when(g.getGeneratedAt()).thenReturn(Instant.now());
        return g;
    }

    @Test
    void returnsGuide_whenCountryResolvedAndCached() {
        VisaCountryGuide guide = guideRow();
        when(jobService.findById("j1")).thenReturn(Optional.of(job("Berlin, Germany")));
        when(repo.findById(eq("de"))).thenReturn(Optional.of(guide));

        Optional<VisaGuideResponse> out = service.forJob("j1");

        assertThat(out).isPresent();
        assertThat(out.get().text()).isEqualTo("독일 Blue Card 경로");
        assertThat(out.get().sources()).hasSize(1);
        assertThat(out.get().sources().get(0).url()).isEqualTo("https://make-it-in-germany.com");
        assertThat(out.get().sources().get(0).retrievedAt()).isEqualTo("2026-06-25");
        assertThat(out.get().disclaimer()).contains("2026-06-25");
    }

    @Test
    void empty_whenCountryUnsupported() {
        when(jobService.findById("j1")).thenReturn(Optional.of(job("Tokyo, Japan")));
        assertThat(service.forJob("j1")).isEmpty();
    }

    @Test
    void empty_whenNoCachedGuide() {
        when(jobService.findById("j1")).thenReturn(Optional.of(job("Amsterdam")));
        when(repo.findById(eq("nl"))).thenReturn(Optional.empty());
        assertThat(service.forJob("j1")).isEmpty();
    }

    @Test
    void empty_whenJobMissing() {
        when(jobService.findById("missing")).thenReturn(Optional.empty());
        assertThat(service.forJob("missing")).isEmpty();
    }
}
