package vn.bdhvs.common.util;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import vn.bdhvs.common.error.ApiException;

/**
 * Giới hạn tần suất theo cửa sổ trượt, lưu trong bộ nhớ (SRS 08 §7).
 * Đủ cho một instance; khi chạy nhiều instance cần chuyển sang Redis (SRS 01).
 */
@Component
public class RateLimiter {

    private final Map<String, Deque<Instant>> hits = new ConcurrentHashMap<>();

    public void check(String key, int limit, Duration window) {
        Instant now = Instant.now();
        Deque<Instant> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && q.peekFirst().isBefore(now.minus(window))) {
                q.pollFirst();
            }
            if (q.size() >= limit) {
                throw ApiException.tooMany("TOO_MANY_REQUESTS", "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút");
            }
            q.addLast(now);
        }
    }

    @Scheduled(fixedDelay = 600_000)
    void cleanup() {
        Instant cutoff = Instant.now().minus(Duration.ofHours(2));
        hits.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                return e.getValue().isEmpty() || e.getValue().peekLast().isBefore(cutoff);
            }
        });
    }
}
