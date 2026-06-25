package com.devjobs.strategist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.devjobs.scout.dto.JobDtos.CompanyDto;
import com.devjobs.scout.dto.JobDtos.JobDetailDto;
import com.devjobs.scout.dto.JobDtos.VisaDto;
import com.devjobs.strategist.dto.ApplicationKitDtos.VisaGuideDto;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class VisaGuideServiceTest {

    private AiClient aiClient;
    private VisaGuideRepository repo;
    private VisaGuideService service;

    @BeforeEach
    void setUp() {
        aiClient = mock(AiClient.class);
        repo = mock(VisaGuideRepository.class);
        service = new VisaGuideService(aiClient, repo);
    }

    private static JobDetailDto job(String location, VisaDto visa) {
        return new JobDetailDto("j1", "Backend Engineer", null,
            new CompanyDto("acme", "Acme", List.of()),
            location, null, false, "full_time",
            "JD", null, null, null, List.of(), visa, null, null, null, "senior");
    }

    @Test
    void buildsGuide_withSourcesAndDisclaimer_whenCountryResolvedAndChunksReturned() {
        when(aiClient.embed(anyString())).thenReturn(List.of(0.1, 0.2, 0.3));
        when(repo.findByCountrySemantic(eq("de"), anyString(), anyInt())).thenReturn(List.of(
            new Object[]{"EU Blue Card 설명", "https://make-it-in-germany.com", "2026-06-25",
                "visa_types", "취업비자 종류"},
            new Object[]{"스폰서 요건", "https://bamf.de", "2026-06-20", "sponsorship", "스폰서십"}));
        when(aiClient.visaGuide(eq("de"), anyString(), any(), any())).thenReturn("독일은 Blue Card 경로가 흔합니다.");

        VisaGuideDto out = service.buildGuide(job("Berlin, Germany", new VisaDto("sponsors", List.of(), false)));

        assertThat(out).isNotNull();
        assertThat(out.text()).isEqualTo("독일은 Blue Card 경로가 흔합니다.");
        assertThat(out.sources()).hasSize(2);
        assertThat(out.sources().get(0).url()).isEqualTo("https://make-it-in-germany.com");
        assertThat(out.disclaimer()).contains("2026-06-25").contains("공식");
    }

    @Test
    void returnsNull_whenCountryNotResolved_andSkipsEmbedAndRetrieve() {
        VisaGuideDto out = service.buildGuide(job("Tokyo, Japan", new VisaDto("unclear", List.of(), false)));

        assertThat(out).isNull();
        verify(aiClient, never()).embed(anyString());
        verify(repo, never()).findByCountrySemantic(anyString(), anyString(), anyInt());
    }

    @Test
    void returnsNull_whenEmbedFails() {
        when(aiClient.embed(anyString())).thenReturn(null);
        VisaGuideDto out = service.buildGuide(job("London, UK", new VisaDto("sponsors", List.of(), false)));
        assertThat(out).isNull();
    }

    @Test
    void returnsNull_whenNoChunksRetrieved() {
        when(aiClient.embed(anyString())).thenReturn(List.of(0.1, 0.2));
        when(repo.findByCountrySemantic(eq("nl"), anyString(), anyInt())).thenReturn(List.of());
        VisaGuideDto out = service.buildGuide(job("Amsterdam", new VisaDto("sponsors", List.of(), false)));
        assertThat(out).isNull();
    }

    @Test
    void returnsNull_whenSynthesisNullOrBlank() {
        when(aiClient.embed(anyString())).thenReturn(List.of(0.1, 0.2));
        List<Object[]> caRows = new java.util.ArrayList<>();
        caRows.add(new Object[]{"Global Talent", "https://canada.ca", "2026-06-25", "visa_types", "비자"});
        when(repo.findByCountrySemantic(eq("ca"), anyString(), anyInt())).thenReturn(caRows);
        when(aiClient.visaGuide(anyString(), anyString(), any(), any())).thenReturn(null);
        VisaGuideDto out = service.buildGuide(job("Toronto, Canada", new VisaDto("sponsors", List.of(), false)));
        assertThat(out).isNull();
    }

    @Test
    void dedupesSourcesBySameUrl_preservingOrder() {
        when(aiClient.embed(anyString())).thenReturn(List.of(0.1, 0.2));
        List<Object[]> rows = new java.util.ArrayList<>();
        rows.add(new Object[]{"청크1", "https://gov.uk/skilled-worker", "2026-06-25", "visa_types", "비자종류"});
        rows.add(new Object[]{"청크2", "https://gov.uk/skilled-worker", "2026-06-25", "sponsorship", "스폰서십"});
        rows.add(new Object[]{"청크3", "https://gov.uk/sponsor-licence", "2026-06-25", "process", "절차"});
        when(repo.findByCountrySemantic(eq("gb"), anyString(), anyInt())).thenReturn(rows);
        when(aiClient.visaGuide(anyString(), anyString(), any(), any())).thenReturn("영국 가이드");

        VisaGuideDto out = service.buildGuide(job("London, UK", new VisaDto("sponsors", List.of(), false)));

        assertThat(out).isNotNull();
        // 같은 url 두 청크 → 출처 1건으로 병합, 서로 다른 url 1건 추가 = 총 2건(순서 유지).
        assertThat(out.sources()).hasSize(2);
        assertThat(out.sources().get(0).url()).isEqualTo("https://gov.uk/skilled-worker");
        assertThat(out.sources().get(1).url()).isEqualTo("https://gov.uk/sponsor-licence");
    }
}
