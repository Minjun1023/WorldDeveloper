package com.devjobs.strategist;

/**
 * 고정창 레이트리밋 추상화.
 * 기본 구현은 {@link InMemoryRateLimiter}(단일 인스턴스). app.ratelimit.redis=true 면
 * {@link RedisRateLimiter}(다중 인스턴스 공유 + 재시작 보존)가 활성화된다.
 */
public interface RateLimiter {

    /** 기본 용량(app.ratelimit.nl-capacity)으로 1회 허용 시도. */
    boolean tryAcquire(String key);

    /** 지정 용량으로 1회 허용 시도. */
    boolean tryAcquire(String key, int capacity);
}
