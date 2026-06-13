package com.devjobs.summarize;

import com.devjobs.domain.JobEntity;
import com.devjobs.domain.JobSummaryEntity;
import com.devjobs.scout.JobRepository;
import com.devjobs.strategist.AiClient;
import com.devjobs.strategist.RateLimiter;
import com.devjobs.summarize.dto.SummaryDtos.SummaryDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SummaryService {

    /** AI 요약 사용 불가(키 미설정/업스트림 오류). 컨트롤러가 503 으로 매핑. */
    public static class SummaryUnavailableException extends RuntimeException {}

    /** AI 요약 레이트리밋 초과. 컨트롤러가 429 로 매핑. */
    public static class SummaryRateLimitedException extends RuntimeException {}

    /** summary_json 직렬화 형태 (4섹션). */
    public record Sections(
        List<String> responsibilities,
        List<String> requirements,
        List<String> visa,
        List<String> compensation
    ) {}

    private final JobSummaryRepository repo;
    private final JobRepository jobRepo;
    private final AiClient ai;
    private final ObjectMapper mapper;
    private final RateLimiter rateLimiter;
    private final int summaryCapacity;

    public SummaryService(JobSummaryRepository repo, JobRepository jobRepo, AiClient ai, ObjectMapper mapper,
                          RateLimiter rateLimiter,
                          @Value("${app.ratelimit.summary-capacity:20}") int summaryCapacity) {
        this.repo = repo;
        this.jobRepo = jobRepo;
        this.ai = ai;
        this.mapper = mapper;
        this.rateLimiter = rateLimiter;
        this.summaryCapacity = summaryCapacity;
    }

    /** 캐시된 요약만 반환(AI 미호출). SSR 기본 펼침용. */
    public Optional<SummaryDto> getCached(String jobId, String lang) {
        return repo.findByJobIdAndLang(jobId, lang).map(e -> toDto(e, true));
    }

    @Transactional
    public Optional<SummaryDto> getOrCreate(String jobId, String lang, String clientKey) {
        Optional<JobSummaryEntity> cached = repo.findByJobIdAndLang(jobId, lang);
        if (cached.isPresent()) {
            return Optional.of(toDto(cached.get(), true));
        }

        JobEntity job = jobRepo.findById(jobId)
            .filter(j -> Boolean.TRUE.equals(j.getIsActive()))
            .orElse(null);
        if (job == null) {
            return Optional.empty();
        }

        // 캐시 미스 = AI 생성(토큰 비용) 발생. IP당 고정창으로 제한.
        if (!rateLimiter.tryAcquire("summary:" + clientKey, summaryCapacity)) {
            throw new SummaryRateLimitedException();
        }

        String src = job.getDescriptionText() != null ? job.getDescriptionText() : job.getDescription();
        AiClient.AiSummary s = ai.summarize(job.getTitle(), src);
        if (s == null) {
            throw new SummaryUnavailableException();
        }

        String json = serialize(new Sections(
            s.responsibilities(), s.requirements(), s.visa(), s.compensation()));
        JobSummaryEntity saved = repo.save(new JobSummaryEntity(jobId, lang, json, s.engine()));
        return Optional.of(toDto(saved, false));
    }

    private SummaryDto toDto(JobSummaryEntity e, boolean cached) {
        Sections sec = deserialize(e.getSummaryJson());
        return new SummaryDto(
            e.getJobId(), e.getLang(),
            sec.responsibilities(), sec.requirements(), sec.visa(), sec.compensation(),
            e.getEngine(), cached);
    }

    private String serialize(Sections sec) {
        try {
            return mapper.writeValueAsString(sec);
        } catch (Exception ex) {
            throw new IllegalStateException("summary 직렬화 실패", ex);
        }
    }

    private Sections deserialize(String json) {
        try {
            return mapper.readValue(json, Sections.class);
        } catch (Exception ex) {
            throw new IllegalStateException("summary 역직렬화 실패", ex);
        }
    }
}
