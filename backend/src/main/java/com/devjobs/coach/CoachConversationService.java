package com.devjobs.coach;

import com.devjobs.coach.dto.CoachDtos.ChatMessage;
import com.devjobs.coach.dto.CoachDtos.ConversationSummary;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 코치 대화 영속화. 저장(최근 200개 캡 + upsert + 기회적 만료 정리), 조회(90일 만료 필터), 삭제.
@Service
public class CoachConversationService {

    private static final int MAX_STORED = 200;
    private static final int EXPIRY_DAYS = 90;

    private final CoachConversationRepository repo;

    public CoachConversationService(CoachConversationRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public void save(UUID userId, String jobId, List<ChatMessage> thread) {
        List<ChatMessage> capped = thread.size() > MAX_STORED
            ? new ArrayList<>(thread.subList(thread.size() - MAX_STORED, thread.size()))
            : new ArrayList<>(thread);
        var entity = repo.findByUserIdAndJobId(userId, jobId)
            .orElseGet(() -> new CoachConversationEntity(userId, jobId));
        entity.setMessages(capped);
        entity.setLastActiveAt(OffsetDateTime.now());
        repo.save(entity);
        // 기회적 만료 정리: 코치가 쓰일 때마다 90일 초과 행을 실제 삭제(스케줄러 불필요).
        repo.deleteByLastActiveAtBefore(OffsetDateTime.now().minusDays(EXPIRY_DAYS));
    }

    @Transactional(readOnly = true)
    public Optional<CoachConversationEntity> get(UUID userId, String jobId) {
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(EXPIRY_DAYS);
        return repo.findByUserIdAndJobId(userId, jobId)
            .filter(c -> c.getLastActiveAt() != null && c.getLastActiveAt().isAfter(cutoff));
    }

    @Transactional
    public void delete(UUID userId, String jobId) {
        repo.deleteByUserIdAndJobId(userId, jobId);
    }

    @Transactional(readOnly = true)
    public List<ConversationSummary> list(UUID userId) {
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(EXPIRY_DAYS);
        return repo.findByUserIdOrderByLastActiveAtDesc(userId).stream()
            .filter(c -> c.getLastActiveAt() != null && c.getLastActiveAt().isAfter(cutoff))
            .map(c -> new ConversationSummary(
                c.getJobId(), "", "", c.getLastActiveAt(), firstUserPreview(c.getMessages())))
            .toList();
    }

    private static String firstUserPreview(List<ChatMessage> messages) {
        return messages.stream()
            .filter(m -> "user".equals(m.role()))
            .map(ChatMessage::content)
            .findFirst()
            .map(s -> s.length() > 80 ? s.substring(0, 80) : s)
            .orElse("");
    }
}
