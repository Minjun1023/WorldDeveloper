package com.devjobs.coach;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.devjobs.coach.dto.CoachDtos.ChatMessage;

import com.devjobs.auth.JwtService;
import com.devjobs.auth.MailService;
import com.devjobs.company.CompanyService;
import com.devjobs.profile.ProfileService;
import com.devjobs.scout.JobService;
import com.devjobs.scout.dto.JobDtos.JobDetailDto;
import com.devjobs.strategist.AiClient;
import com.devjobs.strategist.AiClient.CoachChatResult;
import com.devjobs.strategist.RateLimiter;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
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
    @Autowired CoachConversationRepository conversationRepo;
    @Autowired JdbcTemplate jdbc;

    // FK: coach_conversations.user_id → users(id) 이므로 실제 사용자 행을 먼저 만든다.
    private UUID insertUser() {
        UUID id = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO users (id, email, password_hash, display_name, created_at, email_verified_at) "
            + "VALUES (?, ?, 'x', ?, now(), now())",
            id, "coach_ctrl_" + id + "@example.com", "coachctrl-" + id.toString().substring(0, 8));
        return id;
    }

    private static JobDetailDto minimalJob(String id) {
        // company/visa/remote/salary 등은 buildContext가 null 허용 → 전부 null.
        return new JobDetailDto(id, "Backend Engineer", null, null, null, null, null, null,
            null, null, null, null, null, null, null, null, null, null);
    }

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

    @Test
    void noJobReturnsOkAndDoesNotPersist() throws Exception {
        // 공고를 비우면 일반 이력서/커리어 코칭 — 404 없이 200, 대화는 저장하지 않는다.
        when(rateLimiter.tryAcquire(anyString())).thenReturn(true);
        when(profileService.load(any())).thenReturn(Optional.empty());
        when(aiClient.coachChat(anyString(), anyString(), anyList()))
            .thenReturn(new CoachChatResult("일반 코칭 답변", "gpt-4o-mini"));

        UUID userId = insertUser();
        String token = "Bearer " + jwtService.issue(userId.toString());
        var body = Map.of(
            "job_id", "",
            "resume", "",
            "messages", List.of(Map.of("role", "user", "content", "이력서 잘 쓰는 법 알려줘")));

        mvc.perform(post("/api/v1/me/coach")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)))
            .andExpect(status().isOk());

        // 공고 없는 대화는 저장 키(job_id)가 없으므로 저장되지 않는다.
        assertThat(conversationRepo.findByUserIdAndJobId(userId, "")).isEmpty();
    }

    @Test
    void noJobContextTellsAiNotToGuessJobKeywords() throws Exception {
        // 회귀(#255): 공고 없이 보내면 모델이 '공고 맞춤 키워드'를 지어내던 환각.
        // 백엔드가 grounding 컨텍스트에 '첨부된 공고가 없습니다'를 명시해 추측을 막는다.
        when(rateLimiter.tryAcquire(anyString())).thenReturn(true);
        when(profileService.load(any())).thenReturn(Optional.empty());
        when(aiClient.coachChat(anyString(), anyString(), anyList()))
            .thenReturn(new CoachChatResult("일반 코칭 답변", "gpt-4o-mini"));

        UUID userId = insertUser();
        String token = "Bearer " + jwtService.issue(userId.toString());
        var body = Map.of("job_id", "", "resume", "",
            "messages", List.of(Map.of("role", "user", "content", "이 공고에 맞는 키워드 뭐야")));

        mvc.perform(post("/api/v1/me/coach")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)))
            .andExpect(status().isOk());

        ArgumentCaptor<String> ctx = ArgumentCaptor.forClass(String.class);
        verify(aiClient).coachChat(ctx.capture(), anyString(), anyList());
        assertThat(ctx.getValue()).contains("첨부된 공고가 없습니다");
    }

    @Test
    void successfulCoachPersistsConversation() throws Exception {
        when(rateLimiter.tryAcquire(anyString())).thenReturn(true);
        when(jobService.findById(anyString())).thenReturn(Optional.of(minimalJob("job-persist")));
        when(coachService.resumeOptimize(anyString(), anyString())).thenReturn(Optional.empty());
        when(profileService.load(any())).thenReturn(Optional.empty());
        when(aiClient.coachChat(anyString(), anyString(), anyList()))
            .thenReturn(new CoachChatResult("이력서 조언입니다.", "gpt-4o-mini"));

        UUID userId = insertUser();
        String token = "Bearer " + jwtService.issue(userId.toString());
        var body = Map.of("job_id", "job-persist", "resume", "Go dev 5y",
            "messages", List.of(Map.of("role", "user", "content", "키워드 봐줘")));

        mvc.perform(post("/api/v1/me/coach")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)))
            .andExpect(status().isOk());

        var saved = conversationRepo.findByUserIdAndJobId(userId, "job-persist").orElseThrow();
        assertThat(saved.getMessages()).hasSize(2); // 요청 user 메시지 + assistant 응답
        assertThat(saved.getMessages().get(1).role()).isEqualTo("assistant");
        assertThat(saved.getMessages().get(1).content()).isEqualTo("이력서 조언입니다.");
    }

    @Test
    void getConversationReturnsOwnerThreadAndDeleteClears() throws Exception {
        UUID userId = insertUser();
        String token = "Bearer " + jwtService.issue(userId.toString());
        var e = new CoachConversationEntity(userId, "job-get");
        e.setMessages(List.of(new ChatMessage("user", "q"), new ChatMessage("assistant", "a")));
        e.setLastActiveAt(java.time.OffsetDateTime.now());
        conversationRepo.save(e);

        mvc.perform(get("/api/v1/me/coach/conversation").param("jobId", "job-get")
                .header("Authorization", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.messages.length()").value(2));

        // 다른 사용자는 못 본다(IDOR) — 읽기라 FK 불필요, 임의 UUID JWT 로 충분
        String otherToken = "Bearer " + jwtService.issue(UUID.randomUUID().toString());
        mvc.perform(get("/api/v1/me/coach/conversation").param("jobId", "job-get")
                .header("Authorization", otherToken))
            .andExpect(status().isNoContent());

        // 삭제 후엔 없음
        mvc.perform(delete("/api/v1/me/coach/conversation").param("jobId", "job-get")
                .header("Authorization", token))
            .andExpect(status().isOk());
        mvc.perform(get("/api/v1/me/coach/conversation").param("jobId", "job-get")
                .header("Authorization", token))
            .andExpect(status().isNoContent());
    }
}
