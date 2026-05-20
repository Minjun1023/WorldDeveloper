package com.devjobs.tracker;

import com.devjobs.tracker.dto.TrackerDtos.ApplicationDto;
import com.devjobs.tracker.dto.TrackerDtos.ApplicationListResponse;
import com.devjobs.tracker.dto.TrackerDtos.PatchRequest;
import com.devjobs.tracker.dto.TrackerDtos.PipelineSummary;
import com.devjobs.tracker.dto.TrackerDtos.TrackRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/applications")
public class TrackerController {

    private final TrackerService service;

    public TrackerController(TrackerService service) {
        this.service = service;
    }

    @PostMapping
    public ApplicationDto track(@AuthenticationPrincipal String userId,
                                @RequestBody TrackRequest req) {
        return service.track(userId, req.jobId(), req.status(), req.notes());
    }

    @GetMapping
    public ApplicationListResponse list(@AuthenticationPrincipal String userId) {
        return service.list(userId);
    }

    @PatchMapping("/{jobId}")
    public ApplicationDto patch(@AuthenticationPrincipal String userId,
                                @PathVariable String jobId,
                                @RequestBody PatchRequest req) {
        return service.track(userId, jobId, req.status(), req.notes());
    }

    @GetMapping("/pipeline")
    public PipelineSummary pipeline(@AuthenticationPrincipal String userId) {
        return service.pipeline(userId);
    }
}
