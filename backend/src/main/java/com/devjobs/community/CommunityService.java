package com.devjobs.community;

import com.devjobs.community.dto.CommunityDtos.CommentDto;
import com.devjobs.community.dto.CommunityDtos.CreateCommentRequest;
import com.devjobs.community.dto.CommunityDtos.CreatePostRequest;
import com.devjobs.community.dto.CommunityDtos.EditPostRequest;
import com.devjobs.community.dto.CommunityDtos.PostDetail;
import com.devjobs.community.dto.CommunityDtos.PostListResponse;
import com.devjobs.community.dto.CommunityDtos.PostSummary;
import com.devjobs.community.dto.CommunityDtos.ReactionResponse;
import com.devjobs.community.dto.CommunityDtos.ReportRequest;
import com.devjobs.profile.UserHandle;
import com.devjobs.profile.UserProfileEntity;
import com.devjobs.profile.UserProfileRepository;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CommunityService {

    private static final Set<String> CATEGORIES =
        Set.of("visa", "interview", "salary", "settle", "company", "qna");
    private static final Set<String> SOURCE_TYPES = Set.of("experience", "secondhand", "question");
    private static final int MAX_TITLE = 150;
    private static final int MAX_BODY = 20000;
    private static final int MAX_COMMENT = 5000;

    private final CommunityPostRepository posts;
    private final CommunityCommentRepository comments;
    private final CommunityReactionRepository reactions;
    private final CommunityReportRepository reports;
    private final UserProfileRepository profiles;

    public CommunityService(CommunityPostRepository posts, CommunityCommentRepository comments,
                            CommunityReactionRepository reactions, CommunityReportRepository reports,
                            UserProfileRepository profiles) {
        this.posts = posts;
        this.comments = comments;
        this.reactions = reactions;
        this.reports = reports;
        this.profiles = profiles;
    }

    @Transactional(readOnly = true)
    public PostListResponse list(String category, String company, String country, String jobId,
                                 String q, boolean unanswered, String sort, int page, int size) {
        int sz = Math.min(Math.max(size, 1), 50);
        Sort byCreated = Sort.by(Sort.Direction.DESC, "createdAt");
        Sort order = switch (sort == null ? "" : sort) {
            case "top" -> Sort.by(Sort.Direction.DESC, "score").and(byCreated);
            case "comments" -> Sort.by(Sort.Direction.DESC, "commentCount").and(byCreated);
            default -> byCreated;
        };
        // 검색어는 null 금지(널이면 Postgres 가 lower(?) 의 타입을 bytea 로 추론해 에러) → 빈 문자열=전체 매칭.
        String qParam = q == null ? "" : q.trim();
        List<CommunityPost> rows = posts.search(blankToNull(category), blankToNull(company),
            blankToNull(country), blankToNull(jobId), qParam, unanswered,
            PageRequest.of(Math.max(page, 0), sz, order));
        Map<UUID, String> hmap = handlesFor(rows.stream().map(CommunityPost::getAuthorId).toList());
        List<PostSummary> items = rows.stream().map(p -> toSummary(p, hmap)).toList();
        return new PostListResponse(items, rows.size() == sz);
    }

    @Transactional(readOnly = true)
    public PostDetail get(String postId, UUID viewer) {
        CommunityPost p = posts.findById(uuid(postId))
            .filter(x -> !"removed".equals(x.getStatus()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "글 없음"));
        List<CommunityComment> raw = comments.findByPostIdAndStatusOrderByCreatedAtAsc(p.getId(), "published");
        Set<UUID> authorIds = new HashSet<>();
        authorIds.add(p.getAuthorId());
        raw.forEach(c -> authorIds.add(c.getAuthorId()));
        Map<UUID, String> hmap = handlesFor(authorIds);
        List<CommentDto> cs = raw.stream()
            .map(c -> new CommentDto(c.getId().toString(), displayHandle(c.getAuthorId(), c.isAnonymous(), hmap),
                c.isAnonymous(), c.getBody(), c.getAuthorId().equals(viewer), c.getCreatedAt()))
            .toList();
        boolean reacted = viewer != null && reactions.existsByPostIdAndUserId(p.getId(), viewer);
        return new PostDetail(p.getId().toString(), p.getCategory(), p.getTitle(), p.getBody(),
            displayHandle(p.getAuthorId(), p.isAnonymous(), hmap), p.isAnonymous(), p.getSourceType(), p.getSourceUrl(),
            p.getLinkedCompanySlug(), p.getLinkedJobId(), p.getLinkedCountry(),
            p.getCommentCount(), p.getScore(), reacted, p.getAuthorId().equals(viewer),
            p.getCreatedAt(), cs);
    }

    @Transactional
    public PostDetail create(UUID userId, CreatePostRequest req) {
        String category = req.category();
        if (category == null || !CATEGORIES.contains(category)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "카테고리가 올바르지 않아요");
        }
        String title = trim(req.title());
        String body = trim(req.body());
        if (title.isEmpty() || title.length() > MAX_TITLE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "제목을 1~" + MAX_TITLE + "자로 입력해주세요");
        }
        if (body.isEmpty() || body.length() > MAX_BODY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "본문을 입력해주세요");
        }
        String sourceType = SOURCE_TYPES.contains(req.sourceType()) ? req.sourceType() : "experience";
        CommunityPost p = new CommunityPost(userId, category, title, body, req.anonymous(),
            sourceType, blankToNull(req.sourceUrl()), blankToNull(req.linkedCompanySlug()),
            blankToNull(req.linkedJobId()), blankToNull(req.linkedCountry()));
        posts.save(p);
        return get(p.getId().toString(), userId);
    }

    @Transactional
    public PostDetail edit(UUID userId, String postId, EditPostRequest req) {
        CommunityPost p = ownedPost(userId, postId);
        String title = trim(req.title());
        String body = trim(req.body());
        if (title.isEmpty() || title.length() > MAX_TITLE || body.isEmpty() || body.length() > MAX_BODY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "제목/본문을 확인해주세요");
        }
        p.edit(title, body);
        posts.save(p);
        return get(postId, userId);
    }

    @Transactional
    public void delete(UUID userId, String postId) {
        CommunityPost p = ownedPost(userId, postId);
        posts.delete(p); // FK ON DELETE CASCADE → 댓글/반응 함께 삭제
    }

    @Transactional
    public CommentDto comment(UUID userId, String postId, CreateCommentRequest req) {
        CommunityPost p = posts.findById(uuid(postId))
            .filter(x -> "published".equals(x.getStatus()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "글 없음"));
        String body = trim(req.body());
        if (body.isEmpty() || body.length() > MAX_COMMENT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "댓글을 입력해주세요");
        }
        CommunityComment c = new CommunityComment(p.getId(), userId, body, req.anonymous());
        comments.save(c);
        p.setCommentCount(p.getCommentCount() + 1);
        posts.save(p);
        return new CommentDto(c.getId().toString(), displayHandle(userId, c.isAnonymous(), handlesFor(List.of(userId))),
            c.isAnonymous(), c.getBody(), true, c.getCreatedAt());
    }

    @Transactional
    public ReactionResponse toggleReaction(UUID userId, String postId) {
        CommunityPost p = posts.findById(uuid(postId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "글 없음"));
        boolean reacted;
        if (reactions.existsByPostIdAndUserId(p.getId(), userId)) {
            reactions.deleteByPostIdAndUserId(p.getId(), userId);
            p.setScore(Math.max(0, p.getScore() - 1));
            reacted = false;
        } else {
            reactions.save(new CommunityReaction(p.getId(), userId));
            p.setScore(p.getScore() + 1);
            reacted = true;
        }
        posts.save(p);
        return new ReactionResponse(reacted, p.getScore());
    }

    @Transactional
    public void report(UUID userId, ReportRequest req) {
        String type = "comment".equals(req.targetType()) ? "comment" : "post";
        reports.save(new CommunityReport(type, uuid(req.targetId()), userId, trim(req.reason())));
    }

    // --- helpers ---

    private CommunityPost ownedPost(UUID userId, String postId) {
        CommunityPost p = posts.findById(uuid(postId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "글 없음"));
        if (!p.getAuthorId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "작성자만 수정/삭제할 수 있어요");
        }
        return p;
    }

    private PostSummary toSummary(CommunityPost p, Map<UUID, String> hmap) {
        String plain = p.getBody().replaceAll("\\s+", " ").trim();
        String excerpt = plain.length() > 140 ? plain.substring(0, 140) + "…" : plain;
        return new PostSummary(p.getId().toString(), p.getCategory(), p.getTitle(), excerpt,
            displayHandle(p.getAuthorId(), p.isAnonymous(), hmap), p.isAnonymous(), p.getSourceType(),
            p.getLinkedCompanySlug(), p.getLinkedCountry(), p.getLinkedJobId(),
            p.getCommentCount(), p.getScore(), p.getCreatedAt());
    }

    /** 작성자 표시명. anonymous 면 "익명", 설정한 닉네임 있으면 그것, 없으면 자동 닉네임. */
    private String displayHandle(UUID userId, boolean anonymous, Map<UUID, String> hmap) {
        if (anonymous) return "익명";
        String h = hmap.get(userId);
        return (h != null) ? h : UserHandle.generate(userId);
    }

    /** userId 집합 → 설정된 닉네임 맵(미설정 사용자는 빠짐). */
    private Map<UUID, String> handlesFor(Collection<UUID> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        Map<UUID, String> m = new HashMap<>();
        for (UserProfileEntity e : profiles.findAllById(new HashSet<>(ids))) {
            String h = e.getHandle();
            if (h != null && !h.isBlank()) m.put(e.getUserId(), h);
        }
        return m;
    }

    private static String trim(String s) { return s == null ? "" : s.trim(); }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static UUID uuid(String s) {
        try {
            return UUID.fromString(s);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "잘못된 id");
        }
    }
}
