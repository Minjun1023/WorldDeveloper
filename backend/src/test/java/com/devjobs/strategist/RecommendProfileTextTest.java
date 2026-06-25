package com.devjobs.strategist;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import java.util.List;
import org.junit.jupiter.api.Test;

/** buildProfileText — 쿼리 임베딩 텍스트 구성 (공고측 'Skills:' 앵커와 정렬). */
class RecommendProfileTextTest {

    private static RecommendRequest req(List<String> skills, String bio, String resume) {
        return new RecommendRequest(skills, "senior", null, bio, resume,
            true, null, null, null, null, 6, 99);
    }

    @Test
    void skillsAnchorFrontLoaded() {
        String t = RecommendService.buildProfileText(
            req(List.of("Java", "Spring", "Kafka"), "분산 시스템과 결제 인프라.", null));
        assertTrue(t.startsWith("Skills: Java, Spring, Kafka."), t);
        assertTrue(t.contains("분산 시스템과 결제 인프라."), t);
    }

    @Test
    void handlesMissingBioAndResume() {
        String t = RecommendService.buildProfileText(req(List.of("Go", "Kubernetes"), null, null));
        assertEquals("Skills: Go, Kubernetes.", t);
    }

    @Test
    void blankFieldsIgnored() {
        String t = RecommendService.buildProfileText(req(List.of("Python"), "  ", ""));
        assertEquals("Skills: Python.", t);
    }

    @Test
    void noSkillsStillBuildsFromBio() {
        String t = RecommendService.buildProfileText(req(List.of(), "백엔드 개발자입니다.", null));
        assertEquals("백엔드 개발자입니다.", t);
    }
}
