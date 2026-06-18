package com.devjobs.community.dto;

import java.time.OffsetDateTime;
import java.util.List;

/** 커뮤니티 요청/응답 DTO. Jackson SNAKE_CASE 로 camelCase → snake_case 자동 변환. */
public final class CommunityDtos {

    private CommunityDtos() {}

    // --- 요청 ---
    public record CreatePostRequest(
        String category,
        String title,
        String body,
        boolean anonymous,
        String sourceType,
        String sourceUrl,
        String linkedCompanySlug,
        String linkedJobId,
        String linkedCountry,
        List<String> tags
    ) {}

    public record EditPostRequest(String title, String body, List<String> tags) {}

    public record CreateCommentRequest(String body, boolean anonymous) {}

    public record ReportRequest(String targetType, String targetId, String reason) {}

    // --- 응답 ---
    public record PostSummary(
        String id,
        String category,
        String title,
        String excerpt,
        String authorHandle,
        boolean anonymous,
        String sourceType,
        String linkedCompanySlug,
        String linkedCountry,
        String linkedJobId,
        List<String> tags,
        int commentCount,
        int score,
        int viewCount,
        OffsetDateTime createdAt
    ) {}

    public record CommentDto(
        String id,
        String authorHandle,
        boolean anonymous,
        String body,
        boolean mine,
        OffsetDateTime createdAt
    ) {}

    public record PostDetail(
        String id,
        String category,
        String title,
        String body,
        String authorHandle,
        boolean anonymous,
        String sourceType,
        String sourceUrl,
        String linkedCompanySlug,
        String linkedJobId,
        String linkedCountry,
        List<String> tags,
        int commentCount,
        int score,
        int viewCount,
        boolean viewerReacted,
        boolean mine,
        OffsetDateTime createdAt,
        List<CommentDto> comments
    ) {}

    public record PostListResponse(List<PostSummary> items, boolean hasMore) {}

    public record ReactionResponse(boolean reacted, int score) {}

    // 신고 결과 — alreadyReported(이미 신고함, 중복) / autoHidden(누적 임계치 도달로 자동 숨김).
    public record ReportResult(boolean alreadyReported, boolean autoHidden) {}

    // --- facet 집계(사이드바: 카테고리/국가/태그 카운트) ---
    public record FacetCount(String key, long count) {}

    public record FacetResponse(
        List<FacetCount> categories,
        List<FacetCount> countries,
        List<FacetCount> tags
    ) {}
}
