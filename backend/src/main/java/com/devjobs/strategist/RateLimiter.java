package com.devjobs.strategist;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import org.springframework.stereotype.Component;

/** 인메모리 고정창 레이트리밋 (단일 인스턴스). 키별 독립. */
@Component
public class RateLimiter {

    private final int capacity;
    private final long windowMillis;
    private final LongSupplier clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    private static final class Window {
        long start;
        int count;
    }

    public RateLimiter() {
        this(10, 3_600_000L, System::currentTimeMillis); // 시간당 10회
    }

    RateLimiter(int capacity, long windowMillis, LongSupplier clock) {
        this.capacity = capacity;
        this.windowMillis = windowMillis;
        this.clock = clock;
    }

    public boolean tryAcquire(String key) {
        long now = clock.getAsLong();
        Window w = windows.computeIfAbsent(key, k -> new Window());
        synchronized (w) {
            if (now - w.start >= windowMillis) {
                w.start = now;
                w.count = 0;
            }
            if (w.count >= capacity) {
                return false;
            }
            w.count++;
            return true;
        }
    }
}
