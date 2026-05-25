package com.devjobs.summarize;

import com.devjobs.domain.JobSummaryEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JobSummaryRepository
    extends JpaRepository<JobSummaryEntity, JobSummaryEntity.Key> {

    Optional<JobSummaryEntity> findByJobIdAndLang(String jobId, String lang);
}
