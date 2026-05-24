package com.devjobs.translate.dto;

/** 번역 응답 DTO. Jackson SNAKE_CASE 로 jobId → job_id 변환. */
public final class TranslationDtos {

    private TranslationDtos() {}

    public record TranslationDto(
        String jobId,
        String lang,
        String title,
        String description,
        String engine,
        boolean cached
    ) {}
}
