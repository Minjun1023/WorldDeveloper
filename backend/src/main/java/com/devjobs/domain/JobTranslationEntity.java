package com.devjobs.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.Objects;

/** 공고 번역 캐시 (job_id, lang) 복합 PK. */
@Entity
@Table(name = "job_translations")
@IdClass(JobTranslationEntity.Key.class)
public class JobTranslationEntity {

    @Id
    @Column(name = "job_id")
    private String jobId;

    @Id
    private String lang;

    private String title;
    private String description;
    private String engine;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    protected JobTranslationEntity() {}

    public JobTranslationEntity(
        String jobId, String lang, String title, String description, String engine) {
        this.jobId = jobId;
        this.lang = lang;
        this.title = title;
        this.description = description;
        this.engine = engine;
        this.createdAt = OffsetDateTime.now();
    }

    public String getJobId() { return jobId; }
    public String getLang() { return lang; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getEngine() { return engine; }
    public OffsetDateTime getCreatedAt() { return createdAt; }

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
