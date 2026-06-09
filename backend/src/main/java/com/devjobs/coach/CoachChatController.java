package com.devjobs.coach;

import com.devjobs.coach.dto.CoachDtos.ChatMessage;
import com.devjobs.coach.dto.CoachDtos.CoachReply;
import com.devjobs.coach.dto.CoachDtos.CoachRequest;
import com.devjobs.coach.dto.CoachDtos.ConversationResponse;
import com.devjobs.company.CompanyService;
import com.devjobs.company.dto.CompanyDtos.CompanyDetail;
import com.devjobs.profile.ProfileService;
import com.devjobs.profile.UserProfileEntity;
import com.devjobs.scout.JobService;
import com.devjobs.scout.dto.JobDtos.JobDetailDto;
import com.devjobs.strategist.AiClient;
import com.devjobs.strategist.RateLimiter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 이력서 코치 챗봇 — 공고 JD + 회사 인텔 + 키워드 갭 + 지원자 프로필을 grounding 으로 묶어
 * AI 에 전달하고 대화형 답변을 돌려준다. /api/v1/me/** 는 SecurityConfig 에서 인증 게이트됨.
 * 클래스명: 동일 패키지의 CoachController(/api/v1/jobs/{id}/resume-optimize)와 충돌 회피.
 */
@RestController
@RequestMapping("/api/v1/me/coach")
public class CoachChatController {

    private static final Logger log = LoggerFactory.getLogger(CoachChatController.class);
    private static final int MAX_RESUME = 20_000;
    private static final int MAX_JD = 3_500;
    // ai(coach.py)의 가드와 정합: 메시지당 8k(초과 거절), 대화는 최근 30턴(초과 잘라냄).
    private static final int MAX_MESSAGE_CONTENT = 8_000;
    private static final int MAX_MESSAGES = 30;

    private final JobService jobService;
    private final CompanyService companyService;
    private final ProfileService profileService;
    private final CoachService coachService;
    private final AiClient aiClient;
    private final RateLimiter rateLimiter;
    private final CoachConversationService conversationService;

    public CoachChatController(JobService jobService, CompanyService companyService, ProfileService profileService,
                              CoachService coachService, AiClient aiClient, RateLimiter rateLimiter,
                              CoachConversationService conversationService) {
        this.jobService = jobService;
        this.companyService = companyService;
        this.profileService = profileService;
        this.coachService = coachService;
        this.aiClient = aiClient;
        this.rateLimiter = rateLimiter;
        this.conversationService = conversationService;
    }

    @PostMapping
    public ResponseEntity<CoachReply> coach(@AuthenticationPrincipal String userId, @RequestBody CoachRequest req) {
        if (req.messages() == null || req.messages().isEmpty()
                || !"user".equals(req.messages().get(req.messages().size() - 1).role())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "messages 비어있음/마지막 user 아님");
        }
        var lastMsg = req.messages().get(req.messages().size() - 1);
        if (lastMsg.content() == null || lastMsg.content().isBlank()) {
            // ai 는 빈 메시지를 필터해 마지막 user 가 사라지면 400 → 503 으로 전파되므로 여기서 명확히 거절.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "메시지 내용이 비어있어요");
        }
        for (var m : req.messages()) {
            if (m.content() != null && m.content().length() > MAX_MESSAGE_CONTENT) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "메시지가 너무 길어요");
            }
        }
        if (req.resume() != null && req.resume().length() > MAX_RESUME) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "resume 너무 김");
        }
        if (!rateLimiter.tryAcquire("chat:" + userId)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "요청이 많아요. 잠시 후 다시.");
        }
        var jobOpt = jobService.findById(req.job_id());
        if (jobOpt.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "공고 없음");
        }

        String context = buildContext(jobOpt.get(), req.job_id(), req.resume(), UUID.fromString(userId));
        var msgs = req.messages();
        if (msgs.size() > MAX_MESSAGES) {
            // 오래된 턴을 잘라 전달 페이로드를 묶음(ai 도 동일하게 최근 30턴만 사용). 마지막 user 메시지는 보존됨.
            msgs = msgs.subList(msgs.size() - MAX_MESSAGES, msgs.size());
        }
        var aiMsgs = msgs.stream()
            .map(m -> new AiClient.CoachChatMessage(m.role(), m.content())).toList();
        var result = aiClient.coachChat(context, req.resume() == null ? "" : req.resume(), aiMsgs);
        if (result == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "상담 기능을 사용할 수 없어요.");
        }
        // 대화 저장(best-effort) — 실패해도 채팅 응답엔 영향 주지 않는다. 이력서는 저장하지 않는다.
        try {
            var thread = new ArrayList<>(req.messages());
            thread.add(new ChatMessage("assistant", result.reply()));
            conversationService.save(UUID.fromString(userId), req.job_id(), thread);
        } catch (Exception e) {
            log.warn("coach 대화 저장 실패(무시): {}", e.toString());
        }
        return ResponseEntity.ok(new CoachReply(result.reply()));
    }

    @GetMapping("/conversation")
    public ResponseEntity<ConversationResponse> getConversation(
            @AuthenticationPrincipal String userId, @RequestParam String jobId) {
        return conversationService.get(UUID.fromString(userId), jobId)
            .map(c -> ResponseEntity.ok(
                new ConversationResponse(c.getJobId(), c.getMessages(), c.getLastActiveAt())))
            .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @DeleteMapping("/conversation")
    public ResponseEntity<Void> deleteConversation(
            @AuthenticationPrincipal String userId, @RequestParam String jobId) {
        conversationService.delete(UUID.fromString(userId), jobId);
        return ResponseEntity.ok().build();
    }

    private String buildContext(JobDetailDto job, String jobId, String resume, UUID userId) {
        StringBuilder sb = new StringBuilder();

        String company = job.company() != null ? job.company().displayName() : null;
        String location = job.location();
        sb.append("공고: ").append(nz(job.title()));
        if (company != null && !company.isBlank()) {
            sb.append(" @ ").append(company);
        }
        if (location != null && !location.isBlank()) {
            sb.append(" (").append(location).append(")");
        }
        sb.append("\n");

        if (job.description() != null && !job.description().isBlank()) {
            sb.append("JD:\n").append(truncate(job.description(), MAX_JD)).append("\n");
        }

        // 회사 인텔: CompanyDetail 에 별도 요약 필드가 없어 ats(채용 플랫폼)+tags 를 1줄로 압축.
        if (job.company() != null && job.company().slug() != null) {
            companyService.detail(job.company().slug()).ifPresent(c -> {
                String intel = companyIntel(c);
                if (!intel.isBlank()) {
                    sb.append("회사 정보: ").append(intel).append("\n");
                }
            });
        }

        // 키워드 갭: 이력서가 있을 때만 의미 있음. resumeOptimize 는 비활성/없는 공고면 empty.
        if (resume != null && !resume.isBlank()) {
            coachService.resumeOptimize(jobId, resume).ifPresent(opt -> {
                sb.append("보유 스킬: ").append(joinOrNone(opt.presentKeywords()))
                  .append(" / 공고 요구 중 미보유: ").append(joinOrNone(opt.missingKeywords())).append("\n");
            });
        }

        // 지원자 프로필: 등록돼 있으면 톤/맞춤 답변용 메타로 첨부.
        profileService.load(userId).ifPresent(p -> {
            String profile = profileLine(p);
            if (!profile.isBlank()) {
                sb.append("지원자 프로필: ").append(profile).append("\n");
            }
        });

        return sb.toString();
    }

    private static String companyIntel(CompanyDetail c) {
        StringBuilder b = new StringBuilder();
        if (c.tags() != null && !c.tags().isEmpty()) {
            b.append(String.join(", ", c.tags()));
        }
        if (c.ats() != null && !c.ats().isBlank()) {
            if (b.length() > 0) {
                b.append(" · ");
            }
            b.append("채용 플랫폼 ").append(c.ats());
        }
        return b.toString();
    }

    private static String profileLine(UserProfileEntity p) {
        StringBuilder b = new StringBuilder();
        List<String> skills = p.getSkills();
        if (skills != null && !skills.isEmpty()) {
            b.append("skills=").append(String.join(", ", skills));
        }
        if (p.getSeniority() != null && !p.getSeniority().isBlank()) {
            sep(b);
            b.append("seniority=").append(p.getSeniority());
        }
        List<String> locs = p.getPreferredLocations();
        if (locs != null && !locs.isEmpty()) {
            sep(b);
            b.append("선호지역=").append(String.join(", ", locs));
        }
        return b.toString();
    }

    private static void sep(StringBuilder b) {
        if (b.length() > 0) {
            b.append(", ");
        }
    }

    private static String joinOrNone(List<String> v) {
        return (v == null || v.isEmpty()) ? "없음" : String.join(", ", v);
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
