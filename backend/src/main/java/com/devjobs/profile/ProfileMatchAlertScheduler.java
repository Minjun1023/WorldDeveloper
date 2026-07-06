package com.devjobs.profile;

import com.devjobs.auth.MailService;
import com.devjobs.auth.UserEntity;
import com.devjobs.auth.UserRepository;
import com.devjobs.strategist.RecommendService;
import com.devjobs.strategist.dto.RecommendDtos.RecommendationItem;
import java.time.OffsetDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 프로필 5축 매칭 신규 공고 다이제스트 배치 — FavoriteCompanyAlertScheduler 와 동일 설계(워터마크 멱등).
 *
 * 매일 KST 오전 9시(기본): 옵트인(notify=true) 유저마다 저장 프로필로 추천 파이프라인을 돌려,
 * 워터마크 이후 게시된 공고 중 매칭 점수 상위(임계 이상)만 메일로 보낸다.
 * - 추천 자체(RecommendService)를 재사용하므로 별도 매칭 로직 없음. 유저당 embed 1회 호출은
 *   일 1회 배치라 부담 없음(옵트인 유저 한정).
 * - 신규·고점수 0건이면 메일을 보내지 않고 워터마크도 유지.
 */
@Component
public class ProfileMatchAlertScheduler {

    private static final Logger log = LoggerFactory.getLogger(ProfileMatchAlertScheduler.class);
    private static final int MAX_JOBS_PER_MAIL = 5;
    private static final int CANDIDATE_TOP_K = 30;   // 추천 후보 넉넉히 받아 신규만 거른다
    private static final double MIN_SCORE = 0.6;     // finalScore 0~1 — 확신 있는 매칭만

    private final ProfileMatchAlertRepository alertRepo;
    private final UserProfileRepository profileRepo;
    private final RecommendService recommendService;
    private final UserRepository userRepo;
    private final MailService mail;
    private final String baseUrl;

    public ProfileMatchAlertScheduler(ProfileMatchAlertRepository alertRepo,
                                      UserProfileRepository profileRepo,
                                      RecommendService recommendService,
                                      UserRepository userRepo,
                                      MailService mail,
                                      @Value("${app.base-url}") String baseUrl) {
        this.alertRepo = alertRepo;
        this.profileRepo = profileRepo;
        this.recommendService = recommendService;
        this.userRepo = userRepo;
        this.mail = mail;
        this.baseUrl = baseUrl;
    }

    @Scheduled(cron = "${app.match-alert-cron:0 0 9 * * *}", zone = "Asia/Seoul")
    public void sendDigests() {
        List<ProfileMatchAlertEntity> subs = alertRepo.findByNotifyTrue();
        if (subs.isEmpty()) return;
        int sent = 0;
        for (ProfileMatchAlertEntity s : subs) {
            try {
                if (processOne(s)) sent++;
            } catch (Exception e) {
                log.warn("match alert 실패 (user={}): {}", s.getUserId(), e.toString());
            }
        }
        log.info("match alert 배치 완료: {}/{} 유저 발송", sent, subs.size());
    }

    private boolean processOne(ProfileMatchAlertEntity s) {
        UserProfileEntity profile = profileRepo.findById(s.getUserId()).orElse(null);
        if (profile == null) return false;

        OffsetDateTime since = s.getLastNotifiedAt();
        List<RecommendationItem> fresh = recommendService
            .recommend(ProfileService.toRecommendRequest(profile, null, CANDIDATE_TOP_K))
            .recommendations().stream()
            .filter(r -> r.job().postedAt() != null && r.job().postedAt().isAfter(since))
            .filter(r -> r.score().finalScore() >= MIN_SCORE)
            .limit(MAX_JOBS_PER_MAIL)
            .toList();
        if (fresh.isEmpty()) return false;

        String email = userRepo.findById(s.getUserId()).map(UserEntity::getEmail).orElse(null);
        if (email == null) return false;

        mail.sendSearchDigest(email,
            "[WorldDev] 프로필에 맞는 새 공고 " + fresh.size() + "건",
            buildBody(s, fresh));
        s.setLastNotifiedAt(OffsetDateTime.now());
        alertRepo.save(s);
        return true;
    }

    private String buildBody(ProfileMatchAlertEntity s, List<RecommendationItem> items) {
        StringBuilder b = new StringBuilder();
        b.append("프로필과 잘 맞는 새 공고 ").append(items.size()).append("건이 올라왔어요.\n\n");
        for (RecommendationItem r : items) {
            String title = r.job().titleKo() != null ? r.job().titleKo() : r.job().title();
            b.append("· ").append(title)
                .append(" — ").append(r.job().company().displayName())
                .append(" (매칭 ").append(Math.round(r.score().finalScore() * 100)).append("%)")
                .append("\n  ").append(baseUrl).append("/jobs/").append(r.job().id()).append("\n\n");
        }
        b.append("전체 맞춤 추천 보기: ").append(baseUrl).append("/recommend\n");
        b.append("\n---\n이 알림 그만 받기: ")
            .append(baseUrl).append("/api/alerts/unsubscribe-match?token=").append(s.getUnsubscribeToken())
            .append("\n");
        return b.toString();
    }
}
