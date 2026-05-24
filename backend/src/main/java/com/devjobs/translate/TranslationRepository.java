package com.devjobs.translate;

import com.devjobs.domain.JobTranslationEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TranslationRepository
    extends JpaRepository<JobTranslationEntity, JobTranslationEntity.Key> {

    Optional<JobTranslationEntity> findByJobIdAndLang(String jobId, String lang);
}
