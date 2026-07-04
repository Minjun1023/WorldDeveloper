package com.devjobs.feedback;

import com.devjobs.feedback.dto.FeedbackDtos.FeedbackBatch;
import com.devjobs.feedback.dto.FeedbackDtos.Interactions;
import com.devjobs.feedback.dto.FeedbackDtos.ReactionRequest;
import com.devjobs.scout.JobService;
import com.devjobs.scout.dto.JobDtos.JobDto;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
public class FeedbackController {

    private final FeedbackService feedback;
    private final JobService jobService;

    public FeedbackController(FeedbackService feedback, JobService jobService) {
        this.feedback = feedback;
        this.jobService = jobService;
    }

    private UUID uid(String userId) { return UUID.fromString(userId); }

    @PutMapping("/saved/{jobId}")
    public ResponseEntity<Void> save(@AuthenticationPrincipal String userId, @PathVariable String jobId) {
        feedback.save(uid(userId), jobId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/saved/{jobId}")
    public ResponseEntity<Void> unsave(@AuthenticationPrincipal String userId, @PathVariable String jobId) {
        feedback.unsave(uid(userId), jobId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/saved")
    public List<JobDto> saved(@AuthenticationPrincipal String userId) {
        // 마감 공고 포함(closed=true) — 칸반에서 카드가 조용히 사라지는 대신 "마감됨" 배지로 안내.
        return jobService.byIdsIncludingClosed(feedback.savedJobIds(uid(userId)));
    }

    @PutMapping("/reactions/{jobId}")
    public ResponseEntity<Void> react(@AuthenticationPrincipal String userId, @PathVariable String jobId,
                                      @RequestBody ReactionRequest req) {
        feedback.react(uid(userId), jobId, req.reaction());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/reactions/{jobId}")
    public ResponseEntity<Void> clearReaction(@AuthenticationPrincipal String userId, @PathVariable String jobId) {
        feedback.clearReaction(uid(userId), jobId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/feedback")
    public ResponseEntity<Map<String, Long>> events(@AuthenticationPrincipal String userId,
                                                    @RequestBody FeedbackBatch batch) {
        long n = feedback.recordEvents(uid(userId), batch.events());
        return ResponseEntity.accepted().body(Map.of("recorded", n));
    }

    @GetMapping("/interactions")
    public Interactions interactions(@AuthenticationPrincipal String userId) {
        return feedback.interactions(uid(userId));
    }
}
