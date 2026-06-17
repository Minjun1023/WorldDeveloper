package com.devjobs.community;

import com.devjobs.community.dto.CommunityDtos.CommentDto;
import com.devjobs.community.dto.CommunityDtos.CreateCommentRequest;
import com.devjobs.community.dto.CommunityDtos.CreatePostRequest;
import com.devjobs.community.dto.CommunityDtos.EditPostRequest;
import com.devjobs.community.dto.CommunityDtos.PostDetail;
import com.devjobs.community.dto.CommunityDtos.PostListResponse;
import com.devjobs.community.dto.CommunityDtos.ReactionResponse;
import com.devjobs.community.dto.CommunityDtos.ReportRequest;
import com.devjobs.strategist.RateLimiter;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/community")
public class CommunityController {

    private static final int WRITE_CAPACITY = 60; // 시간당 작성 한도(스팸 가드, LLM 비용 무관)

    private final CommunityService service;
    private final RateLimiter rateLimiter;

    public CommunityController(CommunityService service, RateLimiter rateLimiter) {
        this.service = service;
        this.rateLimiter = rateLimiter;
    }

    // --- 읽기 (공개) ---
    @GetMapping("/posts")
    public PostListResponse list(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String company,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String jobId,
            @RequestParam(required = false, defaultValue = "recent") String sort,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "20") int size) {
        return service.list(category, company, country, jobId, sort, page, size);
    }

    @GetMapping("/posts/{id}")
    public PostDetail get(@AuthenticationPrincipal String principal, @PathVariable String id) {
        return service.get(id, viewer(principal));
    }

    // --- 쓰기 (인증) ---
    @PostMapping("/posts")
    public PostDetail create(@AuthenticationPrincipal String userId, @RequestBody CreatePostRequest req) {
        throttle(userId);
        return service.create(UUID.fromString(userId), req);
    }

    @PatchMapping("/posts/{id}")
    public PostDetail edit(@AuthenticationPrincipal String userId, @PathVariable String id,
                           @RequestBody EditPostRequest req) {
        return service.edit(UUID.fromString(userId), id, req);
    }

    @DeleteMapping("/posts/{id}")
    public void delete(@AuthenticationPrincipal String userId, @PathVariable String id) {
        service.delete(UUID.fromString(userId), id);
    }

    @PostMapping("/posts/{id}/comments")
    public CommentDto comment(@AuthenticationPrincipal String userId, @PathVariable String id,
                              @RequestBody CreateCommentRequest req) {
        throttle(userId);
        return service.comment(UUID.fromString(userId), id, req);
    }

    @PostMapping("/posts/{id}/reactions")
    public ReactionResponse react(@AuthenticationPrincipal String userId, @PathVariable String id) {
        return service.toggleReaction(UUID.fromString(userId), id);
    }

    @PostMapping("/reports")
    public void report(@AuthenticationPrincipal String userId, @RequestBody ReportRequest req) {
        service.report(UUID.fromString(userId), req);
    }

    private void throttle(String userId) {
        if (!rateLimiter.tryAcquire("community:" + userId, WRITE_CAPACITY)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "작성이 너무 잦아요. 잠시 후 다시.");
        }
    }

    /** 공개 GET 의 뷰어 식별 — 비로그인(anonymousUser)·비정상 값이면 null. */
    private UUID viewer(String principal) {
        if (principal == null || "anonymousUser".equals(principal)) return null;
        try {
            return UUID.fromString(principal);
        } catch (Exception e) {
            return null;
        }
    }
}
