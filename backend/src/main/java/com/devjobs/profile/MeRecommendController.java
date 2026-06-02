package com.devjobs.profile;

import com.devjobs.strategist.AiClient;
import com.devjobs.strategist.RateLimiter;
import com.devjobs.strategist.RecommendService;
import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import com.devjobs.strategist.dto.RecommendDtos.RecommendResponse;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/recommend/me")
public class MeRecommendController {

    public record MeRecommendRequest(String note) {}

    private final ProfileService profileService;
    private final RecommendService recommendService;
    private final AiClient aiClient;
    private final RateLimiter rateLimiter;

    public MeRecommendController(ProfileService profileService, RecommendService recommendService,
                                 AiClient aiClient, RateLimiter rateLimiter) {
        this.profileService = profileService;
        this.recommendService = recommendService;
        this.aiClient = aiClient;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping
    public ResponseEntity<?> recommend(@AuthenticationPrincipal String userId,
                                       @RequestBody(required = false) MeRecommendRequest req) {
        UUID id = UUID.fromString(userId);
        if (!rateLimiter.tryAcquire("recommend:" + userId)) {
            return ResponseEntity.status(429).header("Retry-After", "3600")
                .body(Map.of("error", "요청이 많아요. 잠시 후 다시 시도해 주세요."));
        }
        var profileOpt = profileService.load(id);
        if (profileOpt.isEmpty()) {
            return ResponseEntity.status(409).body(Map.of("needs_profile", true,
                "error", "프로필을 먼저 작성해 주세요."));
        }
        AiClient.ParseResult.Profile note = null;
        String noteText = req == null ? null : req.note();
        if (noteText != null && !noteText.isBlank()) {
            AiClient.ParseResult parsed = aiClient.parseProfile(noteText);
            if (parsed != null) note = parsed.profile();
        }
        RecommendRequest rr = ProfileService.toRecommendRequest(profileOpt.get(), note);
        RecommendResponse rec = recommendService.recommend(rr);
        return ResponseEntity.ok(rec);
    }
}
