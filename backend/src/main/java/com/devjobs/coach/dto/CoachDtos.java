package com.devjobs.coach.dto;

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

    public record InterviewPrepResponse(
        String jobId,
        String title,
        String company,
        List<String> stackSpecificTopics,
        List<String> questionsToAskThem,
        List<StageKit> stages,
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
}
