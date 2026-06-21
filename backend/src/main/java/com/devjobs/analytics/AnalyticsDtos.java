package com.devjobs.analytics;

import java.util.List;

/** 분석 퍼널 응답. Jackson SNAKE_CASE 로 signupsTotal → signups_total 등 변환. */
public final class AnalyticsDtos {

    private AnalyticsDtos() {}

    public record TopJob(String jobId, String title, long views) {}

    // 필드명에 숫자가 letter 와 붙으면(7d) Jackson SNAKE_CASE 가 언더스코어를 안 넣는다
    // (signups7d → signups7d). 깔끔한 키를 위해 'Week'(최근 7일) 로 명명.
    public record Summary(
        long signupsTotal,
        long signupsWeek,
        long viewsTotal,
        long viewsWeek,
        long uniqueViewersWeek,
        long returningViewers,
        List<TopJob> topJobsWeek
    ) {}
}
