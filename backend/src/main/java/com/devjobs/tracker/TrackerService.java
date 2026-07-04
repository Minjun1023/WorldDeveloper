package com.devjobs.tracker;

import com.devjobs.domain.JobEntity;
import com.devjobs.scout.JobRepository;
import com.devjobs.tracker.dto.TrackerDtos.ApplicationDto;
import com.devjobs.tracker.dto.TrackerDtos.ApplicationListResponse;
import com.devjobs.tracker.dto.TrackerDtos.PipelineSummary;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TrackerService {

    // funnel 순서 (DESIGN.md)
    private static final List<String> FUNNEL =
        List.of("interested", "applied", "phone_screen", "take_home", "onsite",
            "offer", "accepted", "rejected");

    private final ApplicationRepository appRepo;
    private final JobRepository jobRepo;

    public TrackerService(ApplicationRepository appRepo, JobRepository jobRepo) {
        this.appRepo = appRepo;
        this.jobRepo = jobRepo;
    }

    @Transactional
    public ApplicationDto track(String userId, String jobId, String status, String notes) {
        if (status == null || !FUNNEL.contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "유효하지 않은 지원 상태예요");
        }
        try {
            ApplicationEntity app = appRepo.findByUserIdAndJobId(userId, jobId)
                .map(a -> { a.update(status, notes); return a; })
                .orElseGet(() -> new ApplicationEntity(userId, jobId, status, notes));
            return toDto(appRepo.save(app));
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // find→save 사이 동시 요청이 먼저 INSERT 한 경우 — 그 행을 다시 읽어 갱신(멱등 upsert).
            ApplicationEntity app = appRepo.findByUserIdAndJobId(userId, jobId).orElseThrow(() -> e);
            app.update(status, notes);
            return toDto(appRepo.save(app));
        }
    }

    @Transactional(readOnly = true)
    public ApplicationListResponse list(String userId) {
        List<ApplicationDto> items = appRepo.findByUserIdOrderByUpdatedAtDesc(userId)
            .stream().map(this::toDto).toList();
        return new ApplicationListResponse(items.size(), items);
    }

    @Transactional(readOnly = true)
    public PipelineSummary pipeline(String userId) {
        List<ApplicationEntity> apps = appRepo.findByUserIdOrderByUpdatedAtDesc(userId);
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (String s : FUNNEL) byStatus.put(s, 0L);
        for (ApplicationEntity a : apps) {
            byStatus.merge(a.getStatus(), 1L, Long::sum);
        }
        return new PipelineSummary(apps.size(), byStatus);
    }

    private ApplicationDto toDto(ApplicationEntity a) {
        JobEntity job = jobRepo.findById(a.getJobId()).orElse(null);
        String title = job != null ? job.getTitle() : null;
        String company = job != null && job.getCompany() != null
            ? job.getCompany().getDisplayName() : null;
        return new ApplicationDto(
            a.getJobId(), a.getStatus(), a.getNotes(), a.getUpdatedAt(), title, company);
    }
}
