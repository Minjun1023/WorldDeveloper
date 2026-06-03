package com.devjobs.strategist;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/** 실제 Redis(Testcontainers)로 고정창 동작 검증 — 로컬·CI 동일. */
@Testcontainers
class RedisRateLimiterTest {

    @Container
    static final GenericContainer<?> redis =
        new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    static StringRedisTemplate template;

    @BeforeAll
    static void setup() {
        LettuceConnectionFactory cf =
            new LettuceConnectionFactory(redis.getHost(), redis.getMappedPort(6379));
        cf.afterPropertiesSet();
        template = new StringRedisTemplate(cf);
        template.afterPropertiesSet();
    }

    @Test
    void allowsUpToCapacityThenBlocks() {
        RedisRateLimiter rl = new RedisRateLimiter(template, 3, 60_000L);
        assertTrue(rl.tryAcquire("k-block"));
        assertTrue(rl.tryAcquire("k-block"));
        assertTrue(rl.tryAcquire("k-block"));
        assertFalse(rl.tryAcquire("k-block"));
    }

    @Test
    void keysAreIndependent() {
        RedisRateLimiter rl = new RedisRateLimiter(template, 1, 60_000L);
        assertTrue(rl.tryAcquire("k-a"));
        assertTrue(rl.tryAcquire("k-b"));
        assertFalse(rl.tryAcquire("k-a"));
    }

    @Test
    void respectsPerCallCapacityOverride() {
        RedisRateLimiter rl = new RedisRateLimiter(template, 1, 60_000L);
        assertTrue(rl.tryAcquire("k-cap", 2));
        assertTrue(rl.tryAcquire("k-cap", 2));
        assertFalse(rl.tryAcquire("k-cap", 2));
    }
}
