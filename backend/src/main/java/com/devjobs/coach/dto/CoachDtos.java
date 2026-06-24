package com.devjobs.coach.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * coach 디스킬린(인터뷰 준비 / 이력서 최적화) 응답 DTO.
 * Jackson SNAKE_CASE 전략으로 commonQuestions → common_questions 등 자동 변환.
 */
public final class CoachDtos {

    private CoachDtos() {}

    // --- 인터뷰 준비 ---

    public record StageKit(
        String stage,
        String label,
        String duration,
        String focus,
        List<String> commonQuestions,
        List<String> preparationActions
    ) {}

    /** 공고에서 감지해 단계 가이드를 차등화한 신호(정직성: 무엇으로 조정했는지 노출). */
    public record DetectedContext(
        String level,
        String primaryStack,
        boolean remote
    ) {}

    public record InterviewPrepResponse(
        String jobId,
        String title,
        String company,
        List<String> stackSpecificTopics,
        List<String> questionsToAskThem,
        List<StageKit> stages,
        DetectedContext detected,
        String note
    ) {}

    // --- 이력서 최적화 ---

    public record ResumeOptimizeRequest(String resumeText) {}

    public record ReorderedLine(String line, List<String> matched, int score) {}

    public record ResumeOptimizeResponse(
        String jobId,
        String title,
        String company,
        double matchScore,
        List<String> jobKeywords,
        List<String> presentKeywords,
        List<String> missingKeywords,
        List<String> leadWith,
        List<ReorderedLine> reorderedLines,
        int totalLines,
        List<String> suggestions,
        String note
    ) {}

    // --- 이력서 코치 챗봇 ---

    public record ChatMessage(String role, String content) {}

    public record CoachRequest(String job_id, String resume, List<ChatMessage> messages) {}

    public record CoachReply(String reply) {}

    public record ConversationResponse(String jobId, List<ChatMessage> messages, OffsetDateTime lastActiveAt) {}

    /** 대화 이력 레일 항목 — 공고 라벨(byIds 조인)과 첫 user 메시지 미리보기 포함. */
    public record ConversationSummary(
        String jobId,
        String company,
        String title,
        OffsetDateTime lastActiveAt,
        String preview
    ) {}

    public record ConversationListResponse(List<ConversationSummary> items) {}
}
