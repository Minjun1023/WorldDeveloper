package com.devjobs.coach;

import com.devjobs.coach.dto.CoachDtos.InterviewPrepResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * coach 디스킬린 — 공고 단위 인터뷰 준비 / 이력서 최적화.
 * 인증 불필요(공고 기반 휴리스틱). id 는 콜론 포함이라 {id:.+}.
 */
@RestController
@RequestMapping("/api/v1/jobs/{id:.+}")
public class CoachController {

    private final CoachService service;

    public CoachController(CoachService service) {
        this.service = service;
    }

    @GetMapping("/interview-prep")
    public ResponseEntity<InterviewPrepResponse> interviewPrep(@PathVariable String id) {
        return service.interviewPrep(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
