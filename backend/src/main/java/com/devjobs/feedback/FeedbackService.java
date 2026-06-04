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
    private final JobReactionRepository reactionRepo;
    private final RecommendationFeedbackRepository feedbackRepo;
    private final EntityManager em;

    public FeedbackService(SavedJobRepository savedRepo, JobReactionRepository reactionRepo,
                           RecommendationFeedbackRepository feedbackRepo, EntityManager em) {
        this.savedRepo = savedRepo; this.reactionRepo = reactionRepo;
        this.feedbackRepo = feedbackRepo; this.em = em;
    }

    @Transactional
    public void save(UUID userId, String jobId) {
        if (!savedRepo.existsById(new SavedJobEntity.Key(userId, jobId))) {
            savedRepo.save(new SavedJobEntity(userId, jobId));
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
