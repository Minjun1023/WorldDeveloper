package com.devjobs.popular;

import com.devjobs.scout.dto.JobDtos.JobDto;

public final class PopularJobDtos {

    private PopularJobDtos() {}

    /** 인기 공고 1건 = 공고 + 최근 7일 조회수. Jackson SNAKE_CASE 로 viewCount → view_count. */
    public record PopularJob(JobDto job, long viewCount) {}
}
