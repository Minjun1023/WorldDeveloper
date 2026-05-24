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

        // 번역 입력은 정제된 plain text 우선 (HTML 깨짐 방지)
        String src = job.getDescriptionText() != null ? job.getDescriptionText() : job.getDescription();
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
