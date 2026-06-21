package com.devjobs.analytics;

import com.devjobs.analytics.AnalyticsDtos.Summary;
import com.devjobs.analytics.AnalyticsDtos.TopJob;
import com.devjobs.auth.UserRepository;
import com.devjobs.domain.JobEntity;
import com.devjobs.scout.JobRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnalyticsService {

    private static final int WINDOW_DAYS = 7;
    private static final int TOP_LIMIT = 10;

    private final JobViewRepository viewRepo;
    private final UserRepository userRepo;
    private final JobRepository jobRepo;
    private final Set<String> adminEmails;

    public AnalyticsService(JobViewRepository viewRepo, UserRepository userRepo, JobRepository jobRepo,
                            @Value("${app.admin-emails:}") String adminEmailsCsv) {
        this.viewRepo = viewRepo;
        this.userRepo = userRepo;
        this.jobRepo = jobRepo;
        this.adminEmails = adminEmailsCsv == null || adminEmailsCsv.isBlank() ? Set.of()
            : java.util.Arrays.stream(adminEmailsCsv.split(","))
                .map(s -> s.trim().toLowerCase(Locale.ROOT))
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    public boolean isAdmin(String email) {
        return email != null && adminEmails.contains(email.trim().toLowerCase(Locale.ROOT));
    }

    /** 공고 조회 1건 기록(고유 열람자/일 dedup). 실패해도 페이지 동작에 영향 없도록 호출부에서 무시. */
    @Transactional
    public void recordView(String jobId, String viewerKey, UUID userId) {
        if (jobId == null || jobId.isBlank() || viewerKey == null || viewerKey.isBlank()) return;
        viewRepo.record(jobId, viewerKey, userId);
    }

    @Transactional(readOnly = true)
    public Summary summary() {
        List<Object[]> top = viewRepo.topJobsSince(WINDOW_DAYS, TOP_LIMIT);
        List<String> ids = top.stream().map(r -> (String) r[0]).toList();
        Map<String, String> titleById = jobRepo.findAllById(ids).stream()
            .collect(Collectors.toMap(JobEntity::getId, JobEntity::getTitle, (a, b) -> a));
        List<TopJob> topJobs = new ArrayList<>();
        for (Object[] r : top) {
            String id = (String) r[0];
            long count = ((Number) r[1]).longValue();
            topJobs.add(new TopJob(id, titleById.getOrDefault(id, id), count));
        }
        return new Summary(
            userRepo.count(),
            userRepo.countSince(WINDOW_DAYS),
            viewRepo.viewsTotal(),
            viewRepo.viewsSince(WINDOW_DAYS),
            viewRepo.uniqueViewersSince(WINDOW_DAYS),
            viewRepo.returningViewers(),
            topJobs);
    }
}
