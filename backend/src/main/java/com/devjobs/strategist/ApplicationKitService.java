package com.devjobs.strategist;

import com.devjobs.scout.JobService;
import com.devjobs.scout.dto.JobDtos.JobDetailDto;
import com.devjobs.strategist.dto.ApplicationKitDtos.ApplicationKitResponse;
import com.devjobs.strategist.dto.ApplicationKitDtos.KitSynthesis;
import com.devjobs.strategist.dto.ApplicationKitDtos.SkillGap;
import com.devjobs.strategist.dto.ApplicationKitDtos.VisaInsightDto;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * 지원 키트 조립 — 공고(JobService) + 비자 해석(룰) + 스킬 갭(#310 skill-match) 을 수집하고
 * ai 합성(4종)을 호출해 키트 DTO 로 묶는다. 합성/스킬매칭 실패 시 부분 키트로 graceful 폴백.
 */
@Service
public class ApplicationKitService {
    private static final int MAX_JD = 3500;
    private final JobService jobService;
    private final AiClient aiClient;
    private final VisaGuideService visaGuideService;

    public ApplicationKitService(JobService jobService, AiClient aiClient, VisaGuideService visaGuideService) {
        this.jobService = jobService;
        this.aiClient = aiClient;
        this.visaGuideService = visaGuideService;
    }

    public Optional<ApplicationKitResponse> build(String jobId, String resume) {
        Optional<JobDetailDto> opt = jobService.findById(jobId);
        if (opt.isEmpty()) {
            return Optional.empty();
        }
        JobDetailDto job = opt.get();

        var visa = VisaInterpreter.interpret(job.visa());
        var guide = visaGuideService.buildGuide(job);   // 실패 시 null
        VisaInsightDto visaDto = new VisaInsightDto(visa.confidence(), visa.message(), guide);

        String jd = job.description() == null ? ""
            : job.description().substring(0, Math.min(job.description().length(), MAX_JD));

        // 스킬 갭 (#310 skill-match) — 공고 큐레이션 tags 도 넘겨 JD 산문이 놓친 요구 스킬을 보강. 실패(null) 시 빈 갭.
        var sm = aiClient.skillMatch(jd, resume, job.tags());
        SkillGap gap = sm == null ? new SkillGap(List.of(), List.of(), List.of())
            : new SkillGap(sm.required(), sm.present(), sm.missing());

        // ai 합성 (실패 시 null → 부분 키트).
        Map<String, Object> jobMeta = Map.of(
            "title", nz(job.title()),
            "company", job.company() != null ? nz(job.company().displayName()) : "",
            "location", nz(job.location()),
            "is_remote", Boolean.TRUE.equals(job.isRemote()));
        Map<String, Object> gapMap = Map.of(
            "required", gap.required(), "present", gap.present(), "missing", gap.missing());
        KitSynthesis synthesis = aiClient.applicationKit(jd, resume, jobMeta, gapMap);

        // 응답의 job 은 목록형 JobDto(요약) — 기존 byIds 로 단건 확보.
        return Optional.of(new ApplicationKitResponse(
            jobService.byIds(List.of(jobId)).stream().findFirst().orElse(null),
            visaDto, gap, synthesis));
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
