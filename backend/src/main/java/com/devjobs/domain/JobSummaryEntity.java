package com.devjobs.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.Objects;

/** 공고 요약 캐시 (job_id, lang) 복합 PK. */
@Entity
@Table(name = "job_summaries")
@IdClass(JobSummaryEntity.Key.class)
public class JobSummaryEntity {

    @Id
    @Column(name = "job_id")
    private String jobId;

    @Id
    private String lang;

    @Column(name = "summary_json")
    private String summaryJson;

    private String engine;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    protected JobSummaryEntity() {}

    public JobSummaryEntity(String jobId, String lang, String summaryJson, String engine) {
        this.jobId = jobId;
        this.lang = lang;
        this.summaryJson = summaryJson;
        this.engine = engine;
        this.createdAt = OffsetDateTime.now();
    }

    public String getJobId() { return jobId; }
    public String getLang() { return lang; }
    public String getSummaryJson() { return summaryJson; }
    public String getEngine() { return engine; }

    /** 복합 PK (job_id, lang) */
    public static class Key implements Serializable {
        private String jobId;
        private String lang;

        public Key() {}

        public Key(String jobId, String lang) {
            this.jobId = jobId;
            this.lang = lang;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Key key)) return false;
            return Objects.equals(jobId, key.jobId) && Objects.equals(lang, key.lang);
        }

        @Override
        public int hashCode() {
            return Objects.hash(jobId, lang);
        }
    }
}
