package com.devjobs.analytics;

import java.util.List;

/** 분석 퍼널 응답. Jackson SNAKE_CASE 로 signupsTotal → signups_total 등 변환. */
public final class AnalyticsDtos {

    private AnalyticsDtos() {}

    public record TopJob(String jobId, String title, long views) {}

    public record Summary(
        long signupsTotal,
        long signups7d,
        long viewsTotal,
        long views7d,
        long uniqueViewers7d,
        long returningViewers,
        List<TopJob> topJobs7d
    ) {}
}
