package com.devjobs.strategist;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Redis 고정창 레이트리밋. 다중 인스턴스가 한도를 공유하고 재시작에도 카운터가 보존된다.
 * app.ratelimit.redis=true 일 때만 활성화(그 외에는 {@link InMemoryRateLimiter}).
 *
 * 고정창: 키마다 INCR 로 카운트, 첫 증가 시에만 TTL(window) 설정. count <= capacity 면 허용.
 */
@Component
@ConditionalOnProperty(name = "app.ratelimit.redis", havingValue = "true")
public class RedisRateLimiter implements RateLimiter {

    private static final String PREFIX = "rl:";

    private final StringRedisTemplate redis;
    private final int capacity;
    private final Duration window;

    public RedisRateLimiter(
        StringRedisTemplate redis,
        @Value("${app.ratelimit.nl-capacity:10}") int capacity,
        @Value("${app.ratelimit.nl-window-ms:3600000}") long windowMillis) {
        this.redis = redis;
        this.capacity = capacity;
        this.window = Duration.ofMillis(windowMillis);
    }

    @Override
    public boolean tryAcquire(String key) {
        return tryAcquire(key, this.capacity);
    }

    @Override
    public boolean tryAcquire(String key, int capacity) {
        String k = PREFIX + key;
        Long count = redis.opsForValue().increment(k);
        if (count == null) {
            return true; // Redis 응답 이상 시 fail-open (가용성 우선; 인증은 다른 게이트가 막음).
        }
        if (count == 1L) {
            redis.expire(k, window);
        }
        return count <= capacity;
    }
}
