package com.devjobs.strategist;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** 인메모리 고정창 레이트리밋 (단일 인스턴스). 키별 독립. */
@Component
public class RateLimiter {

    private final int capacity;
    private final long windowMillis;
    private final LongSupplier clock;
    // 항목이 자동으로 제거되지 않음 — 단일 인스턴스 베타용으로 허용 가능 (고유 IP 수에 의해 상한이 정해짐).
    // 다중 인스턴스로 확장 시 Redis로 교체할 것.
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    private static final class Window {
        long start;
        int count;
    }

    // 운영 기본 = 시간당 10회(LLM 비용 가드). 로컬 개발은 build.gradle bootRun 이 환경변수로
    // 한도를 올린다(application.yml 의 ${NL_RATELIMIT_CAPACITY:10} 참고). 운영은 jar 로 띄워
    // 환경변수 미설정 → 기본 10 유지.
    @Autowired
    public RateLimiter(
        @Value("${app.ratelimit.nl-capacity:10}") int capacity,
        @Value("${app.ratelimit.nl-window-ms:3600000}") long windowMillis) {
        this(capacity, windowMillis, System::currentTimeMillis);
    }

    RateLimiter(int capacity, long windowMillis, LongSupplier clock) {
        this.capacity = capacity;
        this.windowMillis = windowMillis;
        this.clock = clock;
    }

    public boolean tryAcquire(String key) {
        return tryAcquire(key, this.capacity);
    }

    public boolean tryAcquire(String key, int capacity) {
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
