package com.devjobs.search;

// JobService.search 파라미터 1:1. JSONB 직렬화 대상(Jackson). null 허용 필드는 미설정 검색.
public record SavedSearchParams(
    String q,
    String visa,
    String location,
    Boolean remote,
    String sort,
    String discipline,
    String region,
    String track,
    boolean includeUnclear
) {}
