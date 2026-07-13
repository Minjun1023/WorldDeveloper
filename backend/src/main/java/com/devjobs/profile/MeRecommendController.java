package com.devjobs.profile;

import com.devjobs.credits.AiCreditService;
import com.devjobs.feedback.FeedbackService;
import com.devjobs.strategist.AiClient;
import com.devjobs.strategist.RateLimiter;
import com.devjobs.strategist.RecommendService;
import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import com.devjobs.strategist.dto.RecommendDtos.RecommendResponse;
import com.devjobs.strategist.dto.RecommendDtos.RecommendationItem;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/recommend/me")
public class MeRecommendController {

    /** topK: 호출처별 개수 제어(홈 미리보기 3 / 추천 페이지 20). JSON 은 전역 SNAKE_CASE 라 top_k. */
    public record MeRecommendRequest(String note, Integer topK) {}

    private final ProfileService profileService;
    private final RecommendService recommendService;
    private final AiClient aiClient;
    private final RateLimiter rateLimiter;
    private final FeedbackService feedbackService;
    private final AiCreditService creditService;

    public MeRecommendController(ProfileService profileService, RecommendService recommendService,
                                 AiClient aiClient, RateLimiter rateLimiter,
                                 FeedbackService feedbackService, AiCreditService creditService) {
        this.profileService = profileService;
        this.recommendService = recommendService;
        this.aiClient = aiClient;
        this.rateLimiter = rateLimiter;
        this.feedbackService = feedbackService;
        this.creditService = creditService;
    }

    @PostMapping
    public ResponseEntity<?> recommend(@AuthenticationPrincipal String userId,
                                       @RequestBody(required = false) MeRecommendRequest req) {
        UUID id = UUID.fromString(userId);
        var profileOpt = profileService.load(id);
        if (profileOpt.isEmpty()) {
            return ResponseEntity.status(409).body(Map.of("needs_profile", true,
                "error", "프로필을 먼저 작성해 주세요."));
        }
        String noteText = req == null ? null : req.note();
        boolean hasNote = noteText != null && !noteText.isBlank();
        // 레이트리밋은 LLM 파싱(비용)이 있는 note 경로에만 적용한다. note 없는 프로필 추천은
        // 랜딩 회원 섹션이 진입마다 자동 호출하므로 제한하지 않는다(임베딩+스코어링은 로컬·저비용).
        if (hasNote && !rateLimiter.tryAcquire("recommend:" + userId)) {
            return ResponseEntity.status(429).header("Retry-After", "3600")
                .body(Map.of("error", "요청이 많아요. 잠시 후 다시 시도해 주세요."));
        }
        // note 파싱은 LLM 폴백 가능(유료) — 일일 크레딧으로 계정당 하루 비용 상한.
        if (hasNote && !creditService.tryConsume(id, AiCreditService.KIND_NOTE)) {
            return ResponseEntity.status(429)
                .body(Map.of("error", "오늘의 조건 파싱 횟수를 모두 사용했어요. 내일 다시 이용할 수 있어요."));
        }
        AiClient.ParseResult.Profile note = null;
        if (hasNote) {
            AiClient.ParseResult parsed = aiClient.parseProfile(noteText);
            if (parsed != null) note = parsed.profile();
            else creditService.refund(id, AiCreditService.KIND_NOTE); // 서비스 귀책 실패 — 환불
        }
        int topK = req != null && req.topK() != null ? req.topK() : ProfileService.DEFAULT_TOP_K;
        RecommendRequest rr = ProfileService.toRecommendRequest(profileOpt.get(), note, topK);
        // 관심없음(dislike)은 서비스에 넘겨 top_k 트리밍 '전에' 제외 → 상위가 dislike 여도 백필돼
        // 개수가 줄지 않는다(이전엔 트리밍 후 제외라 dislike 가 쌓이면 추천 수가 깎였음).
        java.util.Set<String> disliked = feedbackService.dislikedJobIds(id);
        RecommendResponse rec = recommendService.recommend(rr, disliked);
        return ResponseEntity.ok(rec);
    }

    @GetMapping("/score/{jobId:.+}")
    public ResponseEntity<?> score(@AuthenticationPrincipal String userId,
                                   @PathVariable String jobId) {
        UUID id = UUID.fromString(userId);
        var profileOpt = profileService.load(id);
        if (profileOpt.isEmpty()) {
            return ResponseEntity.status(409).body(Map.of("needs_profile", true,
                "error", "프로필을 먼저 작성해 주세요."));
        }
        RecommendRequest rr = ProfileService.toRecommendRequest(profileOpt.get(), (AiClient.ParseResult.Profile) null, 1);
        RecommendationItem item = recommendService.scoreOne(rr, jobId);
        if (item == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(item.score());
    }
}
