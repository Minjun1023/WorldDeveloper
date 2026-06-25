package com.devjobs.strategist;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.devjobs.auth.JwtService;
import com.devjobs.auth.MailService;
import com.devjobs.strategist.dto.ApplicationKitDtos.ApplicationKitResponse;
import com.devjobs.strategist.dto.ApplicationKitDtos.KitSynthesis;
import com.devjobs.strategist.dto.ApplicationKitDtos.SkillGap;
import com.devjobs.strategist.dto.ApplicationKitDtos.VisaInsightDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * ApplicationKitController(/api/v1/me/application-kit) — 인증 게이트 통과(실 JWT 발급) 후
 * 컨트롤러 매핑 분기(400 jobId 누락 / 404 공고 없음 / 429 레이트리밋 / 200 정상)를 검증한다.
 * 협력자는 전부 @MockBean. CoachChatControllerTest 의 SpringBootTest + Testcontainers 스타일을 따른다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ApplicationKitControllerTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @MockBean ApplicationKitService kitService;
    @MockBean RateLimiter rateLimiter;
    // OAuth/메일 협력자는 컨텍스트 부팅용 (CoachChatControllerTest 와 동일).
    @MockBean MailService mailService;

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @Autowired JwtService jwtService;

    private String bearer() {
        return "Bearer " + jwtService.issue(UUID.randomUUID().toString());
    }

    private String json(Object o) throws Exception {
        return om.writeValueAsString(o);
    }

    @Test
    void blankJobIdReturns400() throws Exception {
        when(rateLimiter.tryAcquire(anyString())).thenReturn(true);
        // 와이어 키는 전역 SNAKE_CASE 라 job_id (KitRequest.jobId 로 역직렬화). 공백은 isBlank → 400.
        var body = Map.of("job_id", "  ", "resume", "내 이력서");
        mvc.perform(post("/api/v1/me/application-kit")
                .header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void missingJobIdReturns400() throws Exception {
        when(rateLimiter.tryAcquire(anyString())).thenReturn(true);
        var body = Map.of("resume", "내 이력서");
        mvc.perform(post("/api/v1/me/application-kit")
                .header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void jobNotFoundReturns404() throws Exception {
        when(rateLimiter.tryAcquire(anyString())).thenReturn(true);
        when(kitService.build(anyString(), anyString())).thenReturn(Optional.empty());
        var body = Map.of("job_id", "missing-job", "resume", "내 이력서");
        mvc.perform(post("/api/v1/me/application-kit")
                .header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)))
            .andExpect(status().isNotFound());
    }

    @Test
    void rateLimitedReturns429() throws Exception {
        // 키트는 최대 2회 LLM 호출로 가장 무거운 경로 — 코치와 동일한 레이트리밋 게이트.
        when(rateLimiter.tryAcquire(anyString())).thenReturn(false);
        var body = Map.of("job_id", "job-1", "resume", "내 이력서");
        mvc.perform(post("/api/v1/me/application-kit")
                .header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)))
            .andExpect(status().isTooManyRequests());
    }

    @Test
    void happyPathReturns200WithBody() throws Exception {
        when(rateLimiter.tryAcquire(anyString())).thenReturn(true);
        when(kitService.build(anyString(), anyString())).thenReturn(Optional.of(
            new ApplicationKitResponse(
                null,
                new VisaInsightDto("verified", "스폰서 명부에서 확인됨"),
                new SkillGap(List.of("python", "grpc"), List.of("python"), List.of("grpc")),
                new KitSynthesis("잘 맞음", "보완 전략", "커버레터", List.of("Q1", "Q2")))));
        var body = Map.of("job_id", "job-1", "resume", "내 이력서");
        mvc.perform(post("/api/v1/me/application-kit")
                .header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.skill_gap.missing[0]").value("grpc"))
            .andExpect(jsonPath("$.synthesis.fit_summary").value("잘 맞음"));
    }
}
