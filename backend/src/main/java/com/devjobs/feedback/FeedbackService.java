package com.devjobs.feedback;

import com.devjobs.feedback.dto.FeedbackDtos.FeedbackEvent;
import com.devjobs.feedback.dto.FeedbackDtos.Interactions;
import jakarta.persistence.EntityManager;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FeedbackService {

    private static final Set<String> VALID_ACTIONS = Set.of("impression", "click", "apply_click");
    private static final int MAX_EVENTS = 100;

    private final SavedJobRepository savedRepo;
    private final SavedJobCloseAlertRepository closeAlertRepo;
    private final JobReactionRepository reactionRepo;
    private final RecommendationFeedbackRepository feedbackRepo;
    private final EntityManager em;

    public FeedbackService(SavedJobRepository savedRepo, SavedJobCloseAlertRepository closeAlertRepo,
                           JobReactionRepository reactionRepo,
                           RecommendationFeedbackRepository feedbackRepo, EntityManager em) {
        this.savedRepo = savedRepo; this.closeAlertRepo = closeAlertRepo;
        this.reactionRepo = reactionRepo;
        this.feedbackRepo = feedbackRepo; this.em = em;
    }

    @Transactional
    public void save(UUID userId, String jobId) {
        try {
            if (!savedRepo.existsById(new SavedJobEntity.Key(userId, jobId))) {
                savedRepo.save(new SavedJobEntity(userId, jobId));
            }
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // exists→save 사이 동시 요청(더블클릭)이 먼저 저장한 경우 — 이미 저장됨이 목표 상태라 멱등 처리.
        }
        // 첫 저장 시 마감 알림 설정 자동 생성(기본 켬) — 유저가 꺼둔 설정은 덮어쓰지 않는다.
        if (!closeAlertRepo.existsById(userId)) {
            closeAlertRepo.save(new SavedJobCloseAlertEntity(userId));
        }
    }

    @Transactional
    public void unsave(UUID userId, String jobId) {
        savedRepo.deleteById(new SavedJobEntity.Key(userId, jobId));
    }

    @Transactional(readOnly = true)
    public List<String> savedJobIds(UUID userId) {
        return savedRepo.findByUserIdOrderByCreatedAtDesc(userId).stream()
            .map(SavedJobEntity::getJobId).collect(Collectors.toList());
    }

    @Transactional
    public void react(UUID userId, String jobId, String reaction) {
        if (!reaction.equals("like") && !reaction.equals("dislike")) return;
        var existing = reactionRepo.findById(new JobReactionEntity.Key(userId, jobId));
        if (existing.isPresent()) {
            existing.get().setReaction(reaction);
        } else {
            reactionRepo.save(new JobReactionEntity(userId, jobId, reaction));
        }
    }

    @Transactional
    public void clearReaction(UUID userId, String jobId) {
        reactionRepo.deleteById(new JobReactionEntity.Key(userId, jobId));
    }

    @Transactional(readOnly = true)
    public Set<String> dislikedJobIds(UUID userId) {
        return reactionRepo.findByUserIdAndReaction(userId, "dislike").stream()
            .map(JobReactionEntity::getJobId).collect(Collectors.toSet());
    }

    @Transactional(readOnly = true)
    public Interactions interactions(UUID userId) {
        List<String> saved = savedJobIds(userId);
        Map<String, String> reactions = new LinkedHashMap<>();
        for (JobReactionEntity r : reactionRepo.findByUserId(userId)) {
            reactions.put(r.getJobId(), r.getReaction());
        }
        return new Interactions(saved, reactions);
    }

    @Transactional
    public long recordEvents(UUID userId, List<FeedbackEvent> events) {
        if (events == null) return 0;
        long n = 0;
        for (FeedbackEvent e : events.stream().limit(MAX_EVENTS).toList()) {
            if (e.job_id() == null || !VALID_ACTIONS.contains(e.action())) continue;
            feedbackRepo.save(new RecommendationFeedbackEntity(
                userId, e.job_id(), e.action(), e.rank(), e.score()));
            n++;
        }
        return n;
    }

    @Transactional
    public UUID testInsertUser(String email) {
        UUID id = UUID.randomUUID();
        em.createNativeQuery(
            "INSERT INTO users (id, email, password_hash, display_name, created_at, email_verified_at) "
            + "VALUES (?1, ?2, 'x', ?3, now(), now())")
            .setParameter(1, id).setParameter(2, email).setParameter(3, "fb-" + id.toString().substring(0, 8))
            .executeUpdate();
        return id;
    }
}
