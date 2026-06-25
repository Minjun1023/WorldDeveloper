package com.devjobs.coach;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.devjobs.coach.dto.CoachDtos.ChatMessage;
import com.devjobs.coach.dto.CoachDtos.ResumeOptimizeResponse;

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
import java.util.function.Consumer;
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

    private static JobDetailDto jobWithDescription(String id, String description) {
        // description(9번째 인자)만 채워 skill-match 경로(jd 비어있지 않음)를 태운다.
        return new JobDetailDto(id, "Backend Engineer", null, null, null, null, null, null,
            description, null, null, null, null, null, null, null, null, null);
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
    void skillMatchResultIsUsedForKeywordGap() throws Exception {
        // Phase 1: ai skill-match 가 성공하면 그 present/missing 이 grounding 컨텍스트에 들어가고,
        // 기존 resumeOptimize 폴백은 호출되지 않는다.
        when(rateLimiter.tryAcquire(anyString())).thenReturn(true);
        when(jobService.findById(anyString()))
            .thenReturn(Optional.of(jobWithDescription("job-sm", "Python, Kubernetes, gRPC required")));
        when(profileService.load(any())).thenReturn(Optional.empty());
        when(aiClient.skillMatch(anyString(), anyString(), any())).thenReturn(
            new AiClient.SkillMatchResult(
                List.of("Python", "Kubernetes", "gRPC"),
                List.of("Python", "Kubernetes"),
                List.of("gRPC")));
        when(aiClient.coachChat(anyString(), anyString(), anyList()))
            .thenReturn(new CoachChatResult("ok", "gpt-4o-mini"));

        UUID userId = insertUser();
        String token = "Bearer " + jwtService.issue(userId.toString());
        var body = Map.of("job_id", "job-sm", "resume", "파이썬 쿠버네티스 경험",
            "messages", List.of(Map.of("role", "user", "content", "키워드 봐줘")));

        mvc.perform(post("/api/v1/me/coach")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)))
            .andExpect(status().isOk());

        ArgumentCaptor<String> ctx = ArgumentCaptor.forClass(String.class);
        verify(aiClient).coachChat(ctx.capture(), anyString(), anyList());
        assertThat(ctx.getValue()).contains("보유 스킬: Python, Kubernetes");
        assertThat(ctx.getValue()).contains("공고 요구 중 미보유: gRPC");
        // skill-match 성공 시 폴백(resumeOptimize)은 호출되지 않는다.
        verify(coachService, org.mockito.Mockito.never()).resumeOptimize(anyString(), anyString());
    }

    @Test
    void fallsBackToResumeOptimizeWhenSkillMatchNull() throws Exception {
        // ai 다운(skillMatch null) → 기존 resumeOptimize 경로로 폴백.
        when(rateLimiter.tryAcquire(anyString())).thenReturn(true);
        when(jobService.findById(anyString()))
            .thenReturn(Optional.of(jobWithDescription("job-fb", "Go, Kafka required")));
        when(profileService.load(any())).thenReturn(Optional.empty());
        when(aiClient.skillMatch(anyString(), anyString(), any())).thenReturn(null);
        when(coachService.resumeOptimize(anyString(), anyString())).thenReturn(Optional.of(
            new ResumeOptimizeResponse("job-fb", "Backend Engineer", null, 0.5,
                List.of("go", "kafka"), List.of("go"), List.of("kafka"),
                List.of(), List.of(), 0, List.of(), null)));
        when(aiClient.coachChat(anyString(), anyString(), anyList()))
            .thenReturn(new CoachChatResult("ok", "gpt-4o-mini"));

        UUID userId = insertUser();
        String token = "Bearer " + jwtService.issue(userId.toString());
        var body = Map.of("job_id", "job-fb", "resume", "Go 개발",
            "messages", List.of(Map.of("role", "user", "content", "키워드 봐줘")));

        mvc.perform(post("/api/v1/me/coach")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)))
            .andExpect(status().isOk());

        ArgumentCaptor<String> ctx = ArgumentCaptor.forClass(String.class);
        verify(aiClient).coachChat(ctx.capture(), anyString(), anyList());
        assertThat(ctx.getValue()).contains("보유 스킬: go");
        assertThat(ctx.getValue()).contains("공고 요구 중 미보유: kafka");
        verify(coachService).resumeOptimize(anyString(), anyString());
    }

    @Test
    void streamRelaysChunksAndPersistsWhenJobPresent() throws Exception {
        when(rateLimiter.tryAcquire(anyString())).thenReturn(true);
        when(jobService.findById(anyString())).thenReturn(Optional.of(minimalJob("job-stream")));
        when(coachService.resumeOptimize(anyString(), anyString())).thenReturn(Optional.empty());
        when(profileService.load(any())).thenReturn(Optional.empty());
        when(aiClient.coachChatStream(anyString(), anyString(), anyList(), any())).thenAnswer(inv -> {
            Consumer<String> cb = inv.getArgument(3);
            cb.accept("안녕");
            cb.accept("하세요");
            return "안녕하세요";
        });

        UUID userId = insertUser();
        String token = "Bearer " + jwtService.issue(userId.toString());
        var body = Map.of("job_id", "job-stream", "resume", "Go dev",
            "messages", List.of(Map.of("role", "user", "content", "인사")));

        var mvcResult = mvc.perform(post("/api/v1/me/coach/stream")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body)))
            .andExpect(request().asyncStarted())
            .andReturn();

        mvc.perform(asyncDispatch(mvcResult))
            .andExpect(status().isOk())
            .andExpect(content().string("안녕하세요")); // 청크가 합쳐져 전체 답변

        // 스트림 완료 후 누적 전체가 저장된다(공고 있을 때만).
        var saved = conversationRepo.findByUserIdAndJobId(userId, "job-stream").orElseThrow();
        assertThat(saved.getMessages()).hasSize(2);
        assertThat(saved.getMessages().get(1).content()).isEqualTo("안녕하세요");
    }

    @Test
    void listConversationsSerializesSnakeCaseKeys() throws Exception {
        // 회귀 가드: 글로벌 SNAKE_CASE 전략으로 ConversationSummary(jobId/lastActiveAt)가
        // 와이어에서 job_id/last_active_at 으로 나가야 한다(프론트가 이 키로 읽음).
        UUID userId = insertUser();
        String token = "Bearer " + jwtService.issue(userId.toString());
        var e = new CoachConversationEntity(userId, "job-list");
        e.setMessages(List.of(new ChatMessage("user", "안녕"), new ChatMessage("assistant", "네")));
        e.setLastActiveAt(java.time.OffsetDateTime.now());
        conversationRepo.save(e);

        mvc.perform(get("/api/v1/me/coach/conversations")
                .header("Authorization", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].job_id").value("job-list"))
            .andExpect(jsonPath("$.items[0].last_active_at").exists())
            // camelCase 키는 와이어에 존재하지 않아야 한다(프론트가 undefined 로 읽던 버그).
            .andExpect(jsonPath("$.items[0].jobId").doesNotExist())
            .andExpect(jsonPath("$.items[0].lastActiveAt").doesNotExist());
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
