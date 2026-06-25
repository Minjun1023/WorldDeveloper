package com.devjobs.strategist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.devjobs.scout.JobService;
import com.devjobs.scout.dto.JobDtos.CompanyDto;
import com.devjobs.scout.dto.JobDtos.JobDetailDto;
import com.devjobs.scout.dto.JobDtos.JobDto;
import com.devjobs.scout.dto.JobDtos.VisaDto;
import com.devjobs.strategist.AiClient.SkillMatchResult;
import com.devjobs.strategist.dto.ApplicationKitDtos.ApplicationKitResponse;
import com.devjobs.strategist.dto.ApplicationKitDtos.KitSynthesis;
import com.devjobs.strategist.dto.ApplicationKitDtos.VisaGuideDto;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * ApplicationKitService 조립/폴백 동작 — JobService/AiClient 를 Mockito 로 목하고
 * 정상 조립 / 합성 실패(부분 키트) / 공고 없음(empty) 3가지 케이스를 검증한다.
 */
class ApplicationKitServiceTest {

    private JobService jobService;
    private AiClient aiClient;
    private VisaGuideService visaGuideService;
    private ApplicationKitService service;

    @BeforeEach
    void setUp() {
        jobService = mock(JobService.class);
        aiClient = mock(AiClient.class);
        visaGuideService = mock(VisaGuideService.class);
        service = new ApplicationKitService(jobService, aiClient, visaGuideService);
    }

    private static JobDetailDto jobDetail(String id, VisaDto visa) {
        // id, title, titleKo, company, location, locationKo, isRemote, employmentType,
        // description, applyUrl, postedAt, closesAt, tags, visa, remote, salary, experienceYears, seniority
        return new JobDetailDto(id, "Backend Engineer", null,
            new CompanyDto("acme", "Acme", List.of()),
            "Berlin", null, false, "full_time",
            "JD: python kubernetes grpc", null, null, null, null,
            visa, null, null, null, "senior");
    }

    private static JobDto jobSummary(String id) {
        // id, title, titleKo, company, location, locationKo, isRemote, employmentType,
        // descriptionPreview, applyUrl, postedAt, closesAt, tags, visa, remote, salary, seniority
        return new JobDto(id, "Backend Engineer", null,
            new CompanyDto("acme", "Acme", List.of()),
            "Berlin", null, false, "full_time",
            "JD preview", null, null, null, null, null, null, null, "senior");
    }

    @Test
    void normalCase_synthesisFilled_andVisaConfidencePerRule() {
        String jobId = "job-1";
        when(jobService.findById(jobId)).thenReturn(
            Optional.of(jobDetail(jobId, new VisaDto("sponsors", List.of("UK Home Office"), true))));
        when(jobService.byIds(List.of(jobId))).thenReturn(List.of(jobSummary(jobId)));
        when(aiClient.skillMatch(anyString(), anyString(), any())).thenReturn(
            new SkillMatchResult(List.of("python", "grpc"), List.of("python"), List.of("grpc")));
        when(aiClient.applicationKit(anyString(), anyString(), any(), any())).thenReturn(
            new KitSynthesis("잘 맞음", "보완 전략", "커버레터", List.of("Q1", "Q2")));
        VisaGuideDto guide = new VisaGuideDto("독일 Blue Card 경로",
            java.util.List.of(), "법률·이민 자문이 아닙니다. 2026-06-25 기준 ... 공식 사이트 확인");
        when(visaGuideService.buildGuide(any())).thenReturn(guide);

        Optional<ApplicationKitResponse> out = service.build(jobId, "내 이력서");

        assertThat(out).isPresent();
        ApplicationKitResponse kit = out.get();
        assertThat(kit.job()).isNotNull();
        assertThat(kit.job().id()).isEqualTo(jobId);
        // registerVerified=true → verified 가 가장 강한 신호.
        assertThat(kit.visa().confidence()).isEqualTo("verified");
        assertThat(kit.skillGap().missing()).containsExactly("grpc");
        assertThat(kit.synthesis()).isNotNull();
        assertThat(kit.synthesis().fitSummary()).isEqualTo("잘 맞음");
        assertThat(kit.synthesis().interviewQuestions()).containsExactly("Q1", "Q2");
        assertThat(kit.visa().guide()).isNotNull();
        assertThat(kit.visa().guide().text()).isEqualTo("독일 Blue Card 경로");
    }

    @Test
    void synthesisNull_returnsPartialKit_withJobVisaSkillGapFilled() {
        String jobId = "job-2";
        when(jobService.findById(jobId)).thenReturn(
            Optional.of(jobDetail(jobId, new VisaDto("sponsors", List.of(), false))));
        when(jobService.byIds(List.of(jobId))).thenReturn(List.of(jobSummary(jobId)));
        when(aiClient.skillMatch(anyString(), anyString(), any())).thenReturn(
            new SkillMatchResult(List.of("python"), List.of("python"), List.of()));
        // 합성 실패 → null
        when(aiClient.applicationKit(anyString(), anyString(), any(), any())).thenReturn(null);

        Optional<ApplicationKitResponse> out = service.build(jobId, "내 이력서");

        assertThat(out).isPresent();
        ApplicationKitResponse kit = out.get();
        assertThat(kit.synthesis()).isNull();
        // 부분 키트라도 공고/비자/스킬갭은 채워져 있어야 한다.
        assertThat(kit.job()).isNotNull();
        assertThat(kit.visa().confidence()).isEqualTo("likely");
        assertThat(kit.skillGap().present()).containsExactly("python");
    }

    @Test
    void skillMatchNull_yieldsEmptyGap_butStillBuilds() {
        String jobId = "job-3";
        when(jobService.findById(jobId)).thenReturn(
            Optional.of(jobDetail(jobId, new VisaDto("unclear", List.of(), false))));
        when(jobService.byIds(List.of(jobId))).thenReturn(List.of(jobSummary(jobId)));
        when(aiClient.skillMatch(anyString(), anyString(), any())).thenReturn(null);
        when(aiClient.applicationKit(anyString(), anyString(), any(), any())).thenReturn(null);

        Optional<ApplicationKitResponse> out = service.build(jobId, "내 이력서");

        assertThat(out).isPresent();
        ApplicationKitResponse kit = out.get();
        assertThat(kit.skillGap().required()).isEmpty();
        assertThat(kit.skillGap().missing()).isEmpty();
        assertThat(kit.visa().confidence()).isEqualTo("unclear");
    }

    @Test
    void jobAbsent_returnsEmpty() {
        when(jobService.findById(eq("missing"))).thenReturn(Optional.empty());

        Optional<ApplicationKitResponse> out = service.build("missing", "내 이력서");

        assertThat(out).isEmpty();
    }
}
