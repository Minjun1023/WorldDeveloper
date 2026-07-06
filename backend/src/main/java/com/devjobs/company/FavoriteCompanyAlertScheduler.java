package com.devjobs.company;

import com.devjobs.auth.MailService;
import com.devjobs.auth.UserEntity;
import com.devjobs.auth.UserRepository;
import com.devjobs.domain.CompanyEntity;
import com.devjobs.domain.JobEntity;
import com.devjobs.scout.JobRepository;
import com.devjobs.scout.TitleLocalizer;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 관심 기업 새 공고 이메일 다이제스트 배치 — SearchAlertScheduler 와 동일 설계.
 *
 * 매일 KST 오전 9시(기본): notify=true 인 유저마다 관심 기업들의 워터마크(last_notified_at)
 * 이후 게시 공고를 조회해 상위 N건을 평문 메일로 발송하고 워터마크를 갱신한다.
 * - 워터마크가 큐를 대신한다(유저 단위 멱등) — Redis pub/sub 같은 이벤트 인프라 불필요.
 * - 신규 0건이면 메일을 보내지 않는다("새 공고 없음" 스팸 방지).
 * - 단일 인스턴스 전제. 다중 인스턴스 확장 시 분산 락(ShedLock 등) 필요 — SearchAlertScheduler 주석 참고.
 */
@Component
public class FavoriteCompanyAlertScheduler {

    private static final Logger log = LoggerFactory.getLogger(FavoriteCompanyAlertScheduler.class);
    private static final int MAX_JOBS_PER_MAIL = 10;

    private final FavoriteCompanyAlertRepository alertRepo;
    private final FavoriteCompanyRepository favoriteRepo;
    private final CompanyRepository companyRepo;
    private final JobRepository jobRepo;
    private final UserRepository userRepo;
    private final MailService mail;
    private final String baseUrl;

    public FavoriteCompanyAlertScheduler(FavoriteCompanyAlertRepository alertRepo,
                                         FavoriteCompanyRepository favoriteRepo,
                                         CompanyRepository companyRepo,
                                         JobRepository jobRepo,
                                         UserRepository userRepo,
                                         MailService mail,
                                         @Value("${app.base-url}") String baseUrl) {
        this.alertRepo = alertRepo;
        this.favoriteRepo = favoriteRepo;
        this.companyRepo = companyRepo;
        this.jobRepo = jobRepo;
        this.userRepo = userRepo;
        this.mail = mail;
        this.baseUrl = baseUrl;
    }

    @Scheduled(cron = "${app.company-alert-cron:0 0 9 * * *}", zone = "Asia/Seoul")
    public void sendDigests() {
        List<FavoriteCompanyAlertEntity> subs = alertRepo.findByNotifyTrue();
        if (subs.isEmpty()) return;
        int sent = 0;
        for (FavoriteCompanyAlertEntity s : subs) {
            try {
                if (processOne(s)) sent++;
            } catch (Exception e) {
                // 유저 하나의 실패가 배치 전체를 막지 않도록 격리.
                log.warn("company alert 실패 (user={}): {}", s.getUserId(), e.toString());
            }
        }
        log.info("company alert 배치 완료: {}/{} 유저 발송", sent, subs.size());
    }

    /** 유저 1명 처리. 메일을 보냈으면 true. */
    private boolean processOne(FavoriteCompanyAlertEntity s) {
        List<String> slugs = favoriteRepo.findByUserIdOrderByCreatedAtDesc(s.getUserId()).stream()
            .map(FavoriteCompanyEntity::getCompanySlug)
            .toList();
        if (slugs.isEmpty()) return false;

        List<JobEntity> fresh = jobRepo.findNewByCompanySlugs(slugs, s.getLastNotifiedAt());
        if (fresh.isEmpty()) return false;

        String email = userRepo.findById(s.getUserId()).map(UserEntity::getEmail).orElse(null);
        if (email == null) return false;

        mail.sendSearchDigest(email,
            "[WorldDev] 관심 기업 새 공고 " + fresh.size() + "건",
            buildBody(s, fresh));
        s.setLastNotifiedAt(OffsetDateTime.now());
        alertRepo.save(s);
        return true;
    }

    private String buildBody(FavoriteCompanyAlertEntity s, List<JobEntity> jobs) {
        // 회사 표시명: companies 테이블에 있으면 그 이름, 없으면 slug 그대로.
        Map<String, String> names = companyRepo
            .findAllById(jobs.stream().map(JobEntity::getCompanySlug).distinct().toList())
            .stream()
            .collect(Collectors.toMap(CompanyEntity::getSlug, CompanyEntity::getDisplayName, (a, b) -> a));

        StringBuilder b = new StringBuilder();
        b.append("관심 기업에 새 공고 ").append(jobs.size()).append("건이 올라왔어요.\n\n");
        for (JobEntity j : jobs.stream().limit(MAX_JOBS_PER_MAIL).toList()) {
            String company = names.getOrDefault(j.getCompanySlug(), j.getCompanySlug());
            b.append("· ").append(TitleLocalizer.localize(j.getTitle()))
                .append(" — ").append(company);
            if (j.getLocation() != null && !j.getLocation().isBlank()) {
                b.append(" (").append(j.getLocation()).append(")");
            }
            b.append("\n  ").append(baseUrl).append("/jobs/").append(j.getId()).append("\n\n");
        }
        if (jobs.size() > MAX_JOBS_PER_MAIL) {
            b.append("… 외 ").append(jobs.size() - MAX_JOBS_PER_MAIL).append("건 더 보기: ")
                .append(baseUrl).append("/bookmarks?tab=companies\n\n");
        }
        b.append("---\n이 알림 그만 받기: ")
            .append(baseUrl).append("/api/alerts/unsubscribe-company?token=").append(s.getUnsubscribeToken())
            .append("\n");
        return b.toString();
    }
}
