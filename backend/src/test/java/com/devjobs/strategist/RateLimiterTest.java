package com.devjobs.strategist;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class RateLimiterTest {

    @Test
    void allowsUpToCapacityThenBlocks() {
        long[] now = {0L};
        RateLimiter rl = new InMemoryRateLimiter(3, 1000L, () -> now[0]);
        assertTrue(rl.tryAcquire("ip"));
        assertTrue(rl.tryAcquire("ip"));
        assertTrue(rl.tryAcquire("ip"));
        assertFalse(rl.tryAcquire("ip"));
    }

    @Test
    void resetsAfterWindow() {
        long[] now = {0L};
        RateLimiter rl = new InMemoryRateLimiter(1, 1000L, () -> now[0]);
        assertTrue(rl.tryAcquire("ip"));
        assertFalse(rl.tryAcquire("ip"));
        now[0] = 1000L;
        assertTrue(rl.tryAcquire("ip"));
    }

    @Test
    void keysAreIndependent() {
        long[] now = {0L};
        RateLimiter rl = new InMemoryRateLimiter(1, 1000L, () -> now[0]);
        assertTrue(rl.tryAcquire("a"));
        assertTrue(rl.tryAcquire("b"));
    }
}
