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
        String fwd = http.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) {
            return fwd.split(",")[0].trim();
        }
        return http.getRemoteAddr();
    }
}
