package com.devjobs.community;

import com.devjobs.community.dto.CommunityDtos.CommentDto;
import com.devjobs.community.dto.CommunityDtos.CreateCommentRequest;
import com.devjobs.community.dto.CommunityDtos.CreatePostRequest;
import com.devjobs.community.dto.CommunityDtos.EditPostRequest;
import com.devjobs.community.dto.CommunityDtos.FacetCount;
import com.devjobs.community.dto.CommunityDtos.FacetResponse;
import com.devjobs.community.dto.CommunityDtos.PostDetail;
import com.devjobs.community.dto.CommunityDtos.PostListResponse;
import com.devjobs.community.dto.CommunityDtos.PostSummary;
import com.devjobs.community.dto.CommunityDtos.ReactionResponse;
import com.devjobs.community.dto.CommunityDtos.ReportRequest;
import com.devjobs.community.dto.CommunityDtos.ReportResult;
import com.devjobs.profile.UserHandle;
import com.devjobs.profile.UserProfileEntity;
import com.devjobs.profile.UserProfileRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
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
    private static final int AUTO_HIDE_REPORTS = 3; // 고유 신고자 N명 누적 시 자동 숨김(status='flagged')
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
                                 String tag, String q, boolean unanswered, String sort, int page, int size) {
        int sz = Math.min(Math.max(size, 1), 50);
        Sort byCreated = Sort.by(Sort.Direction.DESC, "createdAt");
        Sort order = switch (sort == null ? "" : sort) {
            case "top" -> Sort.by(Sort.Direction.DESC, "score").and(byCreated);
            case "comments" -> Sort.by(Sort.Direction.DESC, "commentCount").and(byCreated);
            default -> byCreated;
        };
        // 검색어는 null 금지(널이면 Postgres 가 lower(?) 의 타입을 bytea 로 추론해 에러) → 빈 문자열=전체 매칭.
        String qParam = q == null ? "" : q.trim();
        if (qParam.length() > 100) qParam = qParam.substring(0, 100);  // 초장문 검색어 DoS 방지
        List<CommunityPost> rows = posts.search(blankToNull(category), blankToNull(company),
            blankToNull(country), blankToNull(jobId), blankToNull(tag), qParam, unanswered,
            PageRequest.of(Math.max(page, 0), sz, order));
        Map<UUID, String> hmap = handlesFor(rows.stream().map(CommunityPost::getAuthorId).toList());
        List<PostSummary> items = rows.stream().map(p -> toSummary(p, hmap)).toList();
        return new PostListResponse(items, rows.size() == sz);
    }

    @Transactional(readOnly = true)
    public FacetResponse facets() {
        return new FacetResponse(
            toFacetCounts(posts.countByCategory()),
            toFacetCounts(posts.countByCountry()),
            toFacetCounts(posts.countByTag(PageRequest.of(0, 30))));
    }

    /** 글 조회 1회 등록 — 고유 열람자(로그인=userId, 익명=IP 해시)당 최초 1회만 카운트 증가. */
    @Transactional
    public void registerView(String postId, String viewerKey) {
        if (viewerKey == null || viewerKey.isBlank()) return;
        UUID pid = uuid(postId);
        if (!posts.existsById(pid)) return;
        if (posts.recordView(pid, viewerKey) > 0) {
            posts.incrementViewCount(pid);
        }
    }

    @Transactional(readOnly = true)
    public PostDetail get(String postId, UUID viewer) {
        CommunityPost p = posts.findById(uuid(postId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "글 없음"));
        // 미게시(신고 누적 flagged / removed) 글은 작성자만 열람 가능, 그 외엔 숨김(404).
        boolean isAuthor = viewer != null && p.getAuthorId().equals(viewer);
        if (!"published".equals(p.getStatus()) && !isAuthor) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "글 없음");
        }
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
            p.getLinkedCompanySlug(), p.getLinkedJobId(), p.getLinkedCountry(), List.copyOf(p.getTags()),
            p.getCommentCount(), p.getScore(), p.getViewCount(), reacted, p.getAuthorId().equals(viewer),
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
            sourceType, safeUrl(req.sourceUrl()), blankToNull(req.linkedCompanySlug()),
            blankToNull(req.linkedJobId()), blankToNull(req.linkedCountry()), normalizeTags(req.tags()));
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
        p.edit(title, body, normalizeTags(req.tags()));
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
    public ReportResult report(UUID userId, ReportRequest req) {
        String type = "comment".equals(req.targetType()) ? "comment" : "post";
        UUID targetId = uuid(req.targetId());
        // 신고 대상이 실제로 존재해야 함 — 존재하지 않는 UUID 로 신고 테이블 오염 방지.
        boolean exists = "comment".equals(type) ? comments.existsById(targetId) : posts.existsById(targetId);
        if (!exists) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "신고 대상을 찾을 수 없어요");
        }
        // 같은 신고자가 같은 대상을 또 신고하면 행을 만들지 않음(중복 무시, idempotent).
        if (reports.existsByTargetIdAndReporterId(targetId, userId)) {
            return new ReportResult(true, false);
        }
        try {
            reports.save(new CommunityReport(type, targetId, userId, trim(req.reason())));
        } catch (DataIntegrityViolationException e) {
            // 동시 요청 경쟁 — UNIQUE(target_id, reporter_id) 위반 = 이미 신고됨
            return new ReportResult(true, false);
        }
        // 고유 신고자 임계치 도달 → 사람 개입 없이 자동 숨김(status='flagged', 되돌릴 수 있음).
        boolean hidden = false;
        if (reports.countByTargetId(targetId) >= AUTO_HIDE_REPORTS) {
            hidden = autoHide(type, targetId);
        }
        return new ReportResult(false, hidden);
    }

    /** 신고 누적 대상 자동 숨김 — 게시중인 것만 flagged 로. 숨김 발생 시 true. */
    private boolean autoHide(String type, UUID targetId) {
        if ("comment".equals(type)) {
            return comments.findById(targetId)
                .filter(c -> "published".equals(c.getStatus()))
                .map(c -> { c.setStatus("flagged"); comments.save(c); return true; })
                .orElse(false);
        }
        return posts.findById(targetId)
            .filter(p -> "published".equals(p.getStatus()))
            .map(p -> { p.setStatus("flagged"); posts.save(p); return true; })
            .orElse(false);
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
            p.getLinkedCompanySlug(), p.getLinkedCountry(), p.getLinkedJobId(), List.copyOf(p.getTags()),
            p.getCommentCount(), p.getScore(), p.getViewCount(), p.getCreatedAt());
    }

    /** 태그 정규화: # 제거·트림·30자 제한·대소문자 무시 중복제거·최대 5개. */
    private static List<String> normalizeTags(List<String> raw) {
        if (raw == null || raw.isEmpty()) return List.of();
        LinkedHashMap<String, String> seen = new LinkedHashMap<>();
        for (String t : raw) {
            if (t == null) continue;
            String s = t.trim();
            while (s.startsWith("#")) s = s.substring(1).trim();
            if (s.isEmpty() || s.length() > 30) continue;
            seen.putIfAbsent(s.toLowerCase(), s);
            if (seen.size() >= 5) break;
        }
        return new ArrayList<>(seen.values());
    }

    /** Object[]{key, count} 행 → FacetCount(키 null 제외). */
    private static List<FacetCount> toFacetCounts(List<Object[]> rows) {
        List<FacetCount> out = new ArrayList<>();
        for (Object[] r : rows) {
            if (r[0] == null) continue;
            out.add(new FacetCount(r[0].toString(), ((Number) r[1]).longValue()));
        }
        return out;
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

    // 출처 URL 은 프론트에서 <a href> 로 그대로 렌더되므로, http(s) 스킴만 허용한다.
    // (javascript:/data: 등 스킴을 저장하면 클릭 시 저장형 XSS 가 됨.)
    private static String safeUrl(String s) {
        String t = blankToNull(s);
        if (t == null) return null;
        String lower = t.toLowerCase();
        return (lower.startsWith("http://") || lower.startsWith("https://")) ? t : null;
    }

    private static UUID uuid(String s) {
        try {
            return UUID.fromString(s);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "잘못된 id");
        }
    }
}
