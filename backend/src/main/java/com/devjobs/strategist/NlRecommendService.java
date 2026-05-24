package com.devjobs.strategist;

import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import com.devjobs.strategist.dto.RecommendDtos.RecommendResponse;
import com.devjobs.strategist.dto.RecommendDtos.RecommendationItem;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
public class NlRecommendService {

    private static final int MAX_LEN = 200;

    private final RateLimiter rateLimiter;
    private final NlProfileCacheRepository cacheRepo;
    private final AiClient aiClient;
    private final RecommendService recommendService;
    private final ObjectMapper mapper;

    public NlRecommendService(RateLimiter rateLimiter, NlProfileCacheRepository cacheRepo,
                              AiClient aiClient, RecommendService recommendService,
                              ObjectMapper mapper) {
        this.rateLimiter = rateLimiter;
        this.cacheRepo = cacheRepo;
        this.aiClient = aiClient;
        this.recommendService = recommendService;
        this.mapper = mapper;
    }

    public record NlRequest(String text, Integer topK, Integer maxPerCompany) {}

    public record NlRecommendResponse(
        String parseSource,
        AiClient.ParseResult.Profile parsedProfile,
        int totalCandidates,
        int returned,
        List<RecommendationItem> recommendations
    ) {}

    public ResponseEntity<?> recommend(NlRequest req, String clientKey) {
        String text = req.text();
        if (text == null || text.isBlank() || text.length() > MAX_LEN) {
            return ResponseEntity.badRequest().body(Map.of("error", "text 누락 또는 200자 초과"));
        }
        if (!rateLimiter.tryAcquire(clientKey)) {
            return ResponseEntity.status(429).header("Retry-After", "3600")
                .body(Map.of("error", "요청이 많습니다. 잠시 후 다시 시도하세요."));
        }

        String hash = NlCacheKey.hash(text);
        AiClient.ParseResult parsed = loadCache(hash);
        if (parsed == null) {
            parsed = aiClient.parseProfile(text);
            if (parsed == null) {
                return ResponseEntity.status(503).body(Map.of("error", "프로필 파싱 실패(AI 미연결)"));
            }
            saveCache(hash, parsed);
        }

        RecommendRequest rr = toRecommendRequest(parsed.profile(), req);
        RecommendResponse rec = recommendService.recommend(rr);
        return ResponseEntity.ok(new NlRecommendResponse(
            parsed.source(), parsed.profile(),
            rec.totalCandidates(), rec.returned(), rec.recommendations()));
    }

    private AiClient.ParseResult loadCache(String hash) {
        return cacheRepo.findById(hash).map(e -> {
            try {
                return mapper.readValue(e.getProfileJson(), AiClient.ParseResult.class);
            } catch (Exception ex) {
                return null;
            }
        }).orElse(null);
    }

    private void saveCache(String hash, AiClient.ParseResult parsed) {
        try {
            cacheRepo.save(new NlProfileCacheEntity(hash, mapper.writeValueAsString(parsed), parsed.source()));
        } catch (Exception ignored) {
            // 캐시 저장 실패는 치명적이지 않음
        }
    }

    private RecommendRequest toRecommendRequest(AiClient.ParseResult.Profile p, NlRequest req) {
        return new RecommendRequest(
            p.skills(), p.seniority(), p.yearsExperience(),
            null, null, p.needsVisaSponsorship(), p.preferredLocations(),
            p.remotePreference(), p.desiredSalaryUsd(), null,
            req.topK() != null ? req.topK() : 6,
            req.maxPerCompany() != null ? req.maxPerCompany() : 2);
    }
}
