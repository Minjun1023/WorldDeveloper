package com.devjobs.recovery;

import com.devjobs.company.CompanyRepository;
import com.devjobs.domain.JobEntity;
import com.devjobs.recovery.dto.RecoveryDtos.RecoveryResponse;
import com.devjobs.recovery.dto.RecoveryDtos.RecoveryStats;
import com.devjobs.recovery.dto.RecoveryDtos.SimilarCompany;
import com.devjobs.scout.JobRepository;
import com.devjobs.tracker.ApplicationEntity;
import com.devjobs.tracker.ApplicationRepository;
import com.devjobs.tracker.TrackerService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RecoveryService {

    private static final List<String> INTERVIEW_STAGES =
        List.of("phone_screen", "take_home", "onsite");

    private final ApplicationRepository appRepo;
    private final JobRepository jobRepo;
    private final CompanyRepository companyRepo;
    private final TrackerService trackerService;

    public RecoveryService(ApplicationRepository appRepo, JobRepository jobRepo,
                           CompanyRepository companyRepo, TrackerService trackerService) {
        this.appRepo = appRepo;
        this.jobRepo = jobRepo;
        this.companyRepo = companyRepo;
        this.trackerService = trackerService;
    }

    @Transactional
    public Optional<RecoveryResponse> recover(
        String userId, String jobId, String reason, boolean markRejected) {

        Optional<ApplicationEntity> appOpt = appRepo.findByUserIdAndJobId(userId, jobId);
        if (appOpt.isEmpty()) {
            return Optional.empty(); // tracker 에 없는 공고 → 404
        }

        // 1) 상태 업데이트 (선택)
        if (markRejected) {
            String notes = (reason != null && !reason.isBlank()) ? "reason: " + reason : "rejected";
            trackerService.track(userId, jobId, "rejected", notes);
        }

        // 2) 거절 공고의 회사 + 태그 → 비슷한 회사
        JobEntity job = jobRepo.findById(jobId).orElse(null);
        String companyName = null;
        String companySlug = null;
        List<String> sharedTags = List.of();
        List<SimilarCompany> similar = new ArrayList<>();
        if (job != null && job.getCompany() != null) {
            companyName = job.getCompany().getDisplayName();
            companySlug = job.getCompany().getSlug();
            List<String> tags = job.getCompany().getTags();
            if (tags != null && !tags.isEmpty()) {
                sharedTags = tags;
                for (Object[] row : companyRepo.findSimilarByTags(toArrayLiteral(tags), companySlug)) {
                    similar.add(new SimilarCompany(
                        (String) row[0], (String) row[1], ((Number) row[2]).longValue()));
                }
            }
        }

        // 3) 사용자 전체 통계
        List<ApplicationEntity> all = appRepo.findByUserIdOrderByUpdatedAtDesc(userId);
        long total = all.size();
        long rejected = all.stream().filter(a -> "rejected".equals(a.getStatus())).count();
        double rejectionRate = total > 0 ? Math.round((double) rejected / total * 100.0) / 100.0 : 0.0;
        Map<String, Long> breakdown = new LinkedHashMap<>();
        for (ApplicationEntity a : all) breakdown.merge(a.getStatus(), 1L, Long::sum);

        // 4) 다음 행동
        List<String> actions = nextActions(rejected);

        // 5) 사실 기반 격려
        long interviews = all.stream()
            .filter(a -> INTERVIEW_STAGES.contains(a.getStatus())).count();
        long offers = all.stream()
            .filter(a -> "offer".equals(a.getStatus()) || "accepted".equals(a.getStatus())).count();
        String encouragement = String.format(
            "한 곳에서 잘 안 풀린 것이지 가치가 떨어진 게 아닙니다. 지금까지 지원 %d건, "
            + "면접 단계 %d건, 오퍼 %d건 — 데이터로 보면 진행 중입니다.",
            total, interviews, offers);

        ApplicationEntity app = appOpt.get();
        String jobTitle = job != null ? job.getTitle() : null;

        return Optional.of(new RecoveryResponse(
            jobId,
            jobTitle,
            companyName,
            (reason != null && !reason.isBlank()) ? reason : null,
            markRejected,
            sharedTags,
            similar,
            new RecoveryStats(total, rejected, rejectionRate, breakdown),
            actions,
            encouragement));
    }

    private List<String> nextActions(long rejectedCount) {
        List<String> actions = new ArrayList<>();
        if (rejectedCount >= 3) {
            actions.add("누적 거절 " + rejectedCount + "건 — 추천 페이지에서 프로필을 다시 조정해 "
                + "더 잘 맞는 공고를 찾아보세요.");
        }
        actions.add("거절 사유를 메모에 기록해두면 패턴 파악에 도움이 됩니다.");
        actions.add("아래 비슷한 회사들의 공고를 둘러보세요.");
        actions.add("막혔던 기술 주제가 있다면 공고 상세의 인터뷰 준비로 다시 점검하세요.");
        actions.add("이력서 매칭이 약했다면 다른 공고에서 이력서 최적화를 다시 돌려보세요.");
        actions.add("회복엔 시간이 필요합니다. 며칠 쉬고 돌아오는 것도 전략입니다. 거절률은 평균적인 일입니다.");
        return actions;
    }

    // Postgres text[] 리터럴: {"a","b"} — 태그는 단순 슬러그라 큰따옴표만 제거하면 안전
    private String toArrayLiteral(List<String> tags) {
        StringBuilder sb = new StringBuilder("{");
        for (int i = 0; i < tags.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(tags.get(i).replace("\"", "")).append("\"");
        }
        return sb.append("}").toString();
    }
}
