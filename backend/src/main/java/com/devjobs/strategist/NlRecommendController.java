package com.devjobs.strategist;

import com.devjobs.strategist.NlRecommendService.NlRequest;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/recommend/nl")
public class NlRecommendController {

    private final NlRecommendService service;

    public NlRecommendController(NlRecommendService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<?> recommend(@RequestBody NlRequest req, HttpServletRequest http) {
        return service.recommend(req, clientKey(http));
    }

    private String clientKey(HttpServletRequest http) {
        // XFF 수동 파싱 금지 — 위조 가능. forward-headers-strategy 가 반영한 remoteAddr 만 사용.
        return com.devjobs.config.ClientIp.of(http);
    }
}
