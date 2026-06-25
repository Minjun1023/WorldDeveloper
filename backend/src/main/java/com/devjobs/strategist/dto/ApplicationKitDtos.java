package com.devjobs.strategist.dto;

import com.devjobs.scout.dto.JobDtos.JobDto;
import java.util.List;

public final class ApplicationKitDtos {
    private ApplicationKitDtos() {}

    /** ai 합성 결과(4종). 합성 실패 시 null. */
    public record KitSynthesis(
        String fitSummary, String skillStrategy, String coverLetter, List<String> interviewQuestions) {}

    public record SkillGap(List<String> required, List<String> present, List<String> missing) {}

    public record VisaInsightDto(String confidence, String message) {}

    /** 키트 전체 응답. synthesis 가 null 이면 부분 키트(공고+비자+스킬갭). */
    public record ApplicationKitResponse(
        JobDto job, VisaInsightDto visa, SkillGap skillGap, KitSynthesis synthesis) {}
}
