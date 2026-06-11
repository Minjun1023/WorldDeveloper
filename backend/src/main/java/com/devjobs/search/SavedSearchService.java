package com.devjobs.search;

import com.devjobs.scout.JobService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SavedSearchService {

    public record SavedSearchView(UUID id, String label, SavedSearchParams params, long newCount,
                                  java.time.OffsetDateTime lastSeenAt) {}

    private final SavedSearchRepository repo;
    private final JobService jobService;

    public SavedSearchService(SavedSearchRepository repo, JobService jobService) {
        this.repo = repo;
        this.jobService = jobService;
    }

    @Transactional
    public SavedSearchEntity create(UUID userId, String label, SavedSearchParams params) {
        String safe = (label != null && !label.isBlank()) ? label.trim() : summarize(params);
        return repo.save(new SavedSearchEntity(userId, safe, params));
    }

    @Transactional(readOnly = true)
    public List<SavedSearchView> list(UUID userId) {
        return repo.findByUserIdOrderByCreatedAtDesc(userId).stream()
            .map(s -> new SavedSearchView(s.getId(), s.getLabel(), s.getParams(),
                jobService.countMatchesSince(s.getParams(), s.getLastSeenAt()), s.getLastSeenAt()))
            .toList();
    }

    @Transactional
    public void markSeen(UUID userId, UUID id) {
        repo.findByIdAndUserId(id, userId).ifPresent(s -> {
            s.setLastSeenAt(java.time.OffsetDateTime.now());
            repo.save(s);
        });
    }

    @Transactional
    public void delete(UUID userId, UUID id) { repo.deleteByIdAndUserId(id, userId); }

    // 라벨 폴백: 웹이 라벨을 주면 그걸 쓰고, 없을 때만 사람이 읽는 한 줄 요약.
    private static String summarize(SavedSearchParams p) {
        var parts = new java.util.ArrayList<String>();
        if (p.q() != null && !p.q().isBlank()) parts.add(p.q().trim());
        if (p.region() != null) parts.add(p.region());
        if ("sponsors".equals(p.visa())) parts.add("스폰서");
        if (Boolean.TRUE.equals(p.remote())) parts.add("원격");
        return parts.isEmpty() ? "전체 공고" : String.join(" · ", parts);
    }
}
