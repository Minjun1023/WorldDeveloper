package com.devjobs.coach;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.devjobs.auth.JwtService;
import com.devjobs.auth.MailService;
import com.devjobs.company.CompanyService;
import com.devjobs.profile.ProfileService;
import com.devjobs.scout.JobService;
import com.devjobs.strategist.AiClient;
import com.devjobs.strategist.RateLimiter;
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
 * CoachChatController(/api/v1/me/coach) — 인증 게이트 통과(실 JWT 발급) 후 검증/그라운딩 흐름 확인.
 * 협력자는 전부 @MockBean. AuthControllerTest 의 SpringBootTest + Testcontainers 스타일을 따른다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class CoachChatControllerTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @MockBean JobService jobService;
    @MockBean CompanyService companyService;
    @MockBean ProfileService profileService;
    @MockBean CoachService coachService;
    @MockBean AiClient aiClient;
    @MockBean RateLimiter rateLimiter;
    // OAuth/메일 협력자는 컨텍스트 부팅용 (AuthControllerTest 와 동일).
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
    void emptyMessagesReturns400() throws Exception {
        when(rateLimiter.tryAcquire(anyString())).thenReturn(true);
        var body = Map.of("job_id", "job-1", "resume", "", "messages", List.of());
        mvc.perform(post("/api/v1/me/coach")
                .header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void blankLastMessageReturns400() throws Exception {
        when(rateLimiter.tryAcquire(anyString())).thenReturn(true);
        var body = Map.of(
            "job_id", "job-1",
            "resume", "",
            "messages", List.of(Map.of("role", "user", "content", "   ")));
        mvc.perform(post("/api/v1/me/coach")
                .header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void oversizedMessageContentReturns400() throws Exception {
        when(rateLimiter.tryAcquire(anyString())).thenReturn(true);
        var huge = "x".repeat(8_001);
        var body = Map.of(
            "job_id", "job-1",
            "resume", "",
            "messages", List.of(Map.of("role", "user", "content", huge)));
        mvc.perform(post("/api/v1/me/coach")
                .header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void jobNotFoundReturns404() throws Exception {
        when(rateLimiter.tryAcquire(anyString())).thenReturn(true);
        when(jobService.findById(anyString())).thenReturn(Optional.empty());
        var body = Map.of(
            "job_id", "missing-job",
            "resume", "",
            "messages", List.of(Map.of("role", "user", "content", "이력서 봐줘")));
        mvc.perform(post("/api/v1/me/coach")
                .header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)))
            .andExpect(status().isNotFound());
    }
}
