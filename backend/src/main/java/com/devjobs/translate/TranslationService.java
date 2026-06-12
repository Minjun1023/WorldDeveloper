package com.devjobs.translate;

import com.devjobs.domain.JobEntity;
import com.devjobs.domain.JobTranslationEntity;
import com.devjobs.scout.JobRepository;
import com.devjobs.strategist.AiClient;
import com.devjobs.strategist.AiClient.AiTranslation;
import com.devjobs.translate.dto.TranslationDtos.TranslationDto;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TranslationService {

    /** AI 번역을 사용할 수 없음(키 미설정/업스트림 오류). 컨트롤러가 503 으로 매핑. */
    public static class TranslationUnavailableException extends RuntimeException {}

    private final TranslationRepository repo;
    private final JobRepository jobRepo;
    private final AiClient ai;

    public TranslationService(TranslationRepository repo, JobRepository jobRepo, AiClient ai) {
        this.repo = repo;
        this.jobRepo = jobRepo;
        this.ai = ai;
    }

    /** 캐시된 번역만 반환(AI 호출 안 함). SSR 즉시표시용 — 미스면 Optional.empty(호출부가 클라 번역으로 폴백). */
    @Transactional(readOnly = true)
    public Optional<TranslationDto> getCached(String jobId, String lang) {
        return repo.findByJobIdAndLang(jobId, lang).map(e -> toDto(e, true));
    }

    /** 캐시 우선, 없으면 AI 호출 후 저장. 공고 없으면 Optional.empty (404). */
    @Transactional
    public Optional<TranslationDto> getOrCreate(String jobId, String lang) {
        Optional<JobTranslationEntity> cached = repo.findByJobIdAndLang(jobId, lang);
        if (cached.isPresent()) {
            return Optional.of(toDto(cached.get(), true));
        }

        JobEntity job = jobRepo.findById(jobId)
            .filter(j -> Boolean.TRUE.equals(j.getIsActive()))
            .orElse(null);
        if (job == null) {
            return Optional.empty();
        }

        // 번역 입력은 원문 HTML 우선 — AI 가 format=html 로 구조 보존
        String src = job.getDescription() != null ? job.getDescription() : job.getDescriptionText();
        AiTranslation t = ai.translate(job.getTitle(), src, lang);
        if (t == null) {
            throw new TranslationUnavailableException();
        }

        JobTranslationEntity saved = repo.save(new JobTranslationEntity(
            jobId, lang, t.title(), t.description(), t.engine()));
        return Optional.of(toDto(saved, false));
    }

    private TranslationDto toDto(JobTranslationEntity e, boolean cached) {
        return new TranslationDto(
            e.getJobId(), e.getLang(), e.getTitle(), e.getDescription(), e.getEngine(), cached);
    }
}
