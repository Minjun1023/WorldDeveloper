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
        String linkedCountry
    ) {}

    public record EditPostRequest(String title, String body) {}

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
        int commentCount,
        int score,
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
        int commentCount,
        int score,
        boolean viewerReacted,
        boolean mine,
        OffsetDateTime createdAt,
        List<CommentDto> comments
    ) {}

    public record PostListResponse(List<PostSummary> items, boolean hasMore) {}

    public record ReactionResponse(boolean reacted, int score) {}
}
