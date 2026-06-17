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
import java.util.List;
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

    // 닉네임 생성용(결정적 익명 핸들). 실명/이메일 노출 없이 글마다 동일 인물=동일 핸들.
    private static final String[] ADJ = {
        "성실한", "꼼꼼한", "용감한", "차분한", "느긋한", "단단한", "산뜻한", "다정한", "묵직한", "재빠른"
    };
    private static final String[] NOUN = {
        "펭귄", "여우", "수달", "두더지", "고래", "올빼미", "다람쥐", "너구리", "고슴도치", "물범"
    };

    private final CommunityPostRepository posts;
    private final CommunityCommentRepository comments;
    private final CommunityReactionRepository reactions;
    private final CommunityReportRepository reports;

    public CommunityService(CommunityPostRepository posts, CommunityCommentRepository comments,
                            CommunityReactionRepository reactions, CommunityReportRepository reports) {
        this.posts = posts;
        this.comments = comments;
        this.reactions = reactions;
        this.reports = reports;
    }

    @Transactional(readOnly = true)
    public PostListResponse list(String category, String company, String country, String jobId,
                                 String sort, int page, int size) {
        int sz = Math.min(Math.max(size, 1), 50);
        Sort order = "top".equals(sort)
            ? Sort.by(Sort.Direction.DESC, "score").and(Sort.by(Sort.Direction.DESC, "createdAt"))
            : Sort.by(Sort.Direction.DESC, "createdAt");
        List<CommunityPost> rows = posts.search(blankToNull(category), blankToNull(company),
            blankToNull(country), blankToNull(jobId), PageRequest.of(Math.max(page, 0), sz, order));
        List<PostSummary> items = rows.stream().map(this::toSummary).toList();
        return new PostListResponse(items, rows.size() == sz);
    }

    @Transactional(readOnly = true)
    public PostDetail get(String postId, UUID viewer) {
        CommunityPost p = posts.findById(uuid(postId))
            .filter(x -> !"removed".equals(x.getStatus()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "글 없음"));
        List<CommentDto> cs = comments.findByPostIdAndStatusOrderByCreatedAtAsc(p.getId(), "published")
            .stream()
            .map(c -> new CommentDto(c.getId().toString(), handle(c.getAuthorId(), c.isAnonymous()),
                c.isAnonymous(), c.getBody(), c.getAuthorId().equals(viewer), c.getCreatedAt()))
            .toList();
        boolean reacted = viewer != null && reactions.existsByPostIdAndUserId(p.getId(), viewer);
        return new PostDetail(p.getId().toString(), p.getCategory(), p.getTitle(), p.getBody(),
            handle(p.getAuthorId(), p.isAnonymous()), p.isAnonymous(), p.getSourceType(), p.getSourceUrl(),
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
        return new CommentDto(c.getId().toString(), handle(userId, c.isAnonymous()),
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

    private PostSummary toSummary(CommunityPost p) {
        String plain = p.getBody().replaceAll("\\s+", " ").trim();
        String excerpt = plain.length() > 140 ? plain.substring(0, 140) + "…" : plain;
        return new PostSummary(p.getId().toString(), p.getCategory(), p.getTitle(), excerpt,
            handle(p.getAuthorId(), p.isAnonymous()), p.isAnonymous(), p.getSourceType(),
            p.getLinkedCompanySlug(), p.getLinkedCountry(), p.getLinkedJobId(),
            p.getCommentCount(), p.getScore(), p.getCreatedAt());
    }

    /** 결정적 익명 핸들. anonymous 면 "익명". 아니면 userId 해시로 형용사+동물(동일 인물=동일 핸들). */
    private String handle(UUID userId, boolean anonymous) {
        if (anonymous) return "익명";
        int h = Math.abs(userId.hashCode());
        return ADJ[h % ADJ.length] + NOUN[(h / ADJ.length) % NOUN.length] + (h % 90 + 10);
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
