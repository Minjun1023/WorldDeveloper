package com.devjobs.strategist;

import com.devjobs.strategist.dto.VisaGuideDtos.VisaGuideResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 공개 — 공고 국가의 사전합성 비자 가이드. 없으면 204. (CoachController interview-prep 미러) */
@RestController
@RequestMapping("/api/v1/jobs/{id:.+}")
public class VisaGuideController {

    private final VisaGuideQueryService service;

    public VisaGuideController(VisaGuideQueryService service) {
        this.service = service;
    }

    @GetMapping("/visa-guide")
    public ResponseEntity<VisaGuideResponse> visaGuide(@PathVariable String id) {
        return service.forJob(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
