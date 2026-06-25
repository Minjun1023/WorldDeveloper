package com.devjobs.strategist;

import com.devjobs.scout.JobService;
import com.devjobs.strategist.dto.VisaGuideDtos.SourceRef;
import com.devjobs.strategist.dto.VisaGuideDtos.VisaGuideResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * 공고 → 국가 추론 → 사전합성 가이드 캐시 조회. 미지원국/미스/공고없음 → empty.
 * sources 는 시드가 저장한 JSON(snake_case) — 주입된 ObjectMapper(전역 SNAKE_CASE)로 SourceRef 로 역직렬화.
 */
@Service
public class VisaGuideQueryService {

    private final JobService jobService;
    private final VisaCountryGuideRepository repo;
    private final ObjectMapper mapper;

    public VisaGuideQueryService(JobService jobService, VisaCountryGuideRepository repo, ObjectMapper mapper) {
        this.jobService = jobService;
        this.repo = repo;
        this.mapper = mapper;
    }

    public Optional<VisaGuideResponse> forJob(String jobId) {
        return jobService.findById(jobId).flatMap(job -> {
            String country = CountryResolver.resolve(job.location());
            if (country == null) {
                return Optional.empty();
            }
            return repo.findById(country).map(g -> new VisaGuideResponse(
                g.getGuideText(), parseSources(g.getSources()), g.getDisclaimer()));
        });
    }

    private List<SourceRef> parseSources(String json) {
        try {
            return mapper.readValue(json, new TypeReference<List<SourceRef>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }
}
