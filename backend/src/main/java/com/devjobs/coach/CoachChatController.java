package com.devjobs.coach;

import com.devjobs.coach.dto.CoachDtos.ChatMessage;
import com.devjobs.coach.dto.CoachDtos.CoachReply;
import com.devjobs.coach.dto.CoachDtos.CoachRequest;
import com.devjobs.coach.dto.CoachDtos.ConversationListResponse;
import com.devjobs.coach.dto.CoachDtos.ConversationResponse;
import com.devjobs.coach.dto.CoachDtos.ConversationSummary;
import com.devjobs.company.CompanyService;
import com.devjobs.company.dto.CompanyDtos.CompanyDetail;
import com.devjobs.profile.ProfileService;
import com.devjobs.profile.UserProfileEntity;
import com.devjobs.scout.JobService;
import com.devjobs.scout.dto.JobDtos.JobDetailDto;
import com.devjobs.scout.dto.JobDtos.JobDto;
import com.devjobs.strategist.AiClient;
import com.devjobs.strategist.RateLimiter;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

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
        validate(req);
        if (!rateLimiter.tryAcquire("chat:" + userId)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "요청이 많아요. 잠시 후 다시.");
        }
        // 공고는 선택사항: 비워두면 일반 이력서/커리어 코칭. job_id 가 주어졌는데 없으면 그대로 404.
        boolean hasJob = req.job_id() != null && !req.job_id().isBlank();
        JobDetailDto job = null;
        if (hasJob) {
            var jobOpt = jobService.findById(req.job_id());
            if (jobOpt.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "공고 없음");
            }
            job = jobOpt.get();
        }

        String context = buildContext(job, hasJob ? req.job_id() : null, req.resume(), UUID.fromString(userId));
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
        // 대화 저장(best-effort) — 공고 단위로만 저장한다(스키마 PK=user+job). 공고 없는 일반 코칭은 저장하지 않는다.
        if (hasJob) {
            try {
                var thread = new ArrayList<>(req.messages());
                thread.add(new ChatMessage("assistant", result.reply()));
                conversationService.save(UUID.fromString(userId), req.job_id(), thread);
            } catch (Exception e) {
                log.warn("coach 대화 저장 실패(무시): {}", e.toString());
            }
        }
        return ResponseEntity.ok(new CoachReply(result.reply()));
    }

    /** 스트리밍 코치 — 답변을 평문 청크로 흘려 체감 지연을 줄인다. 비-스트림 coach() 와 동일 grounding/검증. */
    @PostMapping("/stream")
    public ResponseEntity<StreamingResponseBody> coachStream(
            @AuthenticationPrincipal String userId, @RequestBody CoachRequest req) {
        validate(req);
        if (!rateLimiter.tryAcquire("chat:" + userId)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "요청이 많아요. 잠시 후 다시.");
        }
        boolean hasJob = req.job_id() != null && !req.job_id().isBlank();
        JobDetailDto job = null;
        if (hasJob) {
            var jobOpt = jobService.findById(req.job_id());
            if (jobOpt.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "공고 없음");
            }
            job = jobOpt.get();
        }
        String context = buildContext(job, hasJob ? req.job_id() : null, req.resume(), UUID.fromString(userId));
        var msgs = req.messages();
        if (msgs.size() > MAX_MESSAGES) {
            msgs = msgs.subList(msgs.size() - MAX_MESSAGES, msgs.size());
        }
        var aiMsgs = msgs.stream()
            .map(m -> new AiClient.CoachChatMessage(m.role(), m.content())).toList();
        String resume = req.resume() == null ? "" : req.resume();
        UUID uid = UUID.fromString(userId);
        boolean persist = hasJob;
        String jobId = req.job_id();
        List<ChatMessage> thread0 = req.messages();

        StreamingResponseBody body = out -> {
            String full = aiClient.coachChatStream(context, resume, aiMsgs, chunk -> {
                try {
                    out.write(chunk.getBytes(StandardCharsets.UTF_8));
                    out.flush();
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
            });
            // 공고 단위로만 저장(PK=user+job). 스트림 완료 후 누적 전체를 저장한다(best-effort).
            if (persist && full != null && !full.isBlank()) {
                try {
                    var thread = new ArrayList<>(thread0);
                    thread.add(new ChatMessage("assistant", full));
                    conversationService.save(uid, jobId, thread);
                } catch (Exception e) {
                    log.warn("coach 스트림 대화 저장 실패(무시): {}", e.toString());
                }
            }
        };
        return ResponseEntity.ok()
            .contentType(new MediaType(MediaType.TEXT_PLAIN, StandardCharsets.UTF_8))
            .body(body);
    }

    private void validate(CoachRequest req) {
        if (req.messages() == null || req.messages().isEmpty()
                || !"user".equals(req.messages().get(req.messages().size() - 1).role())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "messages 비어있음/마지막 user 아님");
        }
        var lastMsg = req.messages().get(req.messages().size() - 1);
        // ai 는 빈 메시지를 필터해 마지막 user 가 사라지면 400 → 503 으로 전파되므로 여기서 명확히 거절.
        if (lastMsg.content() == null || lastMsg.content().isBlank()) {
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
    }

    @GetMapping("/conversation")
    public ResponseEntity<ConversationResponse> getConversation(
            @AuthenticationPrincipal String userId, @RequestParam String jobId) {
        return conversationService.get(UUID.fromString(userId), jobId)
            .map(c -> ResponseEntity.ok(
                new ConversationResponse(c.getJobId(), c.getMessages(), c.getLastActiveAt())))
            .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/conversations")
    public ResponseEntity<ConversationListResponse> listConversations(
            @AuthenticationPrincipal String userId) {
        List<ConversationSummary> base = conversationService.list(UUID.fromString(userId));
        List<String> ids = base.stream().map(ConversationSummary::jobId).toList();
        Map<String, JobDto> byId = jobService.byIds(ids).stream()
            .collect(Collectors.toMap(JobDto::id, Function.identity(), (a, b) -> a));
        List<ConversationSummary> withLabels = base.stream().map(s -> {
            JobDto j = byId.get(s.jobId());
            String company = j != null ? j.company().displayName() : "(만료된 공고)";
            String title = j != null ? j.title() : s.jobId();
            return new ConversationSummary(s.jobId(), company, title, s.lastActiveAt(), s.preview());
        }).toList();
        return ResponseEntity.ok(new ConversationListResponse(withLabels));
    }

    @DeleteMapping("/conversation")
    public ResponseEntity<Void> deleteConversation(
            @AuthenticationPrincipal String userId, @RequestParam String jobId) {
        conversationService.delete(UUID.fromString(userId), jobId);
        return ResponseEntity.ok().build();
    }

    private String buildContext(JobDetailDto job, String jobId, String resume, UUID userId) {
        StringBuilder sb = new StringBuilder();

        // 공고가 있으면 JD·회사 인텔·키워드 갭으로 그라운딩. 없으면(일반 코칭) 생략하고 프로필만 첨부.
        if (job != null) {
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

            // 키워드 갭: 이력서가 있을 때만 의미 있음.
            // 1순위: ai /internal/skill-match (확장 taxonomy + semantic 매칭, Phase 1).
            // ai 다운/실패(null) 시 기존 resumeOptimize(고정 어휘 + 별칭, #306) 로 폴백.
            if (resume != null && !resume.isBlank()) {
                String jd = job.description() != null ? truncate(job.description(), MAX_JD) : "";
                // 공고 큐레이션 tags 도 넘겨 JD 산문이 놓친 요구 스킬을 보강(skill_gap 공백 해소).
                AiClient.SkillMatchResult sm =
                    jd.isBlank() ? null : aiClient.skillMatch(jd, resume, job.tags());
                if (sm != null) {
                    log.info("skill-match: required={} present={} missing={}",
                        size(sm.required()), size(sm.present()), size(sm.missing()));
                    sb.append("보유 스킬: ").append(joinOrNone(sm.present()))
                      .append(" / 공고 요구 중 미보유: ").append(joinOrNone(sm.missing())).append("\n");
                } else {
                    // 폴백: resumeOptimize 는 비활성/없는 공고면 empty.
                    coachService.resumeOptimize(jobId, resume).ifPresent(opt -> {
                        sb.append("보유 스킬: ").append(joinOrNone(opt.presentKeywords()))
                          .append(" / 공고 요구 중 미보유: ").append(joinOrNone(opt.missingKeywords())).append("\n");
                    });
                }
            }
        } else {
            // 공고 미첨부(일반 코칭) — 모델이 특정 공고를 가정/추측해 '공고 맞춤 키워드'를 지어내지 않도록
            // 명시한다(#255 로 공고가 선택사항이 된 뒤 발생하던 환각 방지).
            sb.append("대상 공고: 첨부된 공고가 없습니다. 특정 공고의 요구 기술/키워드를 추측하지 말고, ")
              .append("이력서 기반의 일반 조언만 제공하세요.\n");
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

    private static int size(List<String> v) {
        return v == null ? 0 : v.size();
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
