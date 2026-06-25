package com.devjobs.strategist.dto;

import com.devjobs.scout.dto.JobDtos.JobDto;
import java.time.LocalDate;
import java.util.List;

public final class ApplicationKitDtos {
    private ApplicationKitDtos() {}

    /** ai 합성 결과(4종). 합성 실패 시 null. */
    public record KitSynthesis(
        String fitSummary, String skillStrategy, String coverLetter, List<String> interviewQuestions) {}

    public record SkillGap(List<String> required, List<String> present, List<String> missing) {}

    /** RAG 가이드의 출처 한 건 — 회수 청크에서 결정적으로 부착(LLM 생성 아님). */
    public record SourceRef(String title, String url, LocalDate retrievedAt) {}

    /** 비자 RAG 가이드. 회수 0/국가 미지원/합성 실패 시 VisaInsightDto.guide=null. */
    public record VisaGuideDto(String text, List<SourceRef> sources, String disclaimer) {}

    /** 규칙 판정(confidence/message) + 선택적 RAG 가이드(guide, null 가능). */
    public record VisaInsightDto(String confidence, String message, VisaGuideDto guide) {}

    /** 키트 전체 응답. synthesis 가 null 이면 부분 키트(공고+비자+스킬갭). */
    public record ApplicationKitResponse(
        JobDto job, VisaInsightDto visa, SkillGap skillGap, KitSynthesis synthesis) {}
}
