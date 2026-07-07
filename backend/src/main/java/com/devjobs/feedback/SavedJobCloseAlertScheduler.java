package com.devjobs.feedback;

import com.devjobs.auth.MailService;
import com.devjobs.auth.UserEntity;
import com.devjobs.auth.UserRepository;
import com.devjobs.domain.CompanyEntity;
import com.devjobs.domain.JobEntity;
import com.devjobs.scout.TitleLocalizer;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import com.devjobs.company.CompanyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 저장(관심) 공고 마감 알림 배치 — FavoriteCompanyAlertScheduler 와 동일 설계.
 *
 * 매일 KST 오전 9시(기본): notify=true 인 유저마다 '마감으로 전환됐지만 아직 통지 안 된'
 * 저장 공고를 찾아 1회 알리고 saved_jobs.closed_notified_at 을 마킹한다.
 * - 마감 판정은 ETL 생존 감지(is_active=false: deactivate_stale/unseen 등) + closes_at 경과.
 * - 마감 시각이 따로 없어 워터마크 대신 행 단위 플래그로 멱등을 보장한다.
 * - 헛지원 방지가 목적: "저장해 둔 공고가 닫혔으니 파이프라인에서 정리하세요" 신호.
 */
@Component
public class SavedJobCloseAlertScheduler {

    private static final Logger log = LoggerFactory.getLogger(SavedJobCloseAlertScheduler.class);
    private static final int MAX_JOBS_PER_MAIL = 10;

    private final SavedJobCloseAlertRepository alertRepo;
    private final SavedJobRepository savedRepo;
    private final CompanyRepository companyRepo;
    private final UserRepository userRepo;
    private final MailService mail;
    private final String baseUrl;

    public SavedJobCloseAlertScheduler(SavedJobCloseAlertRepository alertRepo,
                                       SavedJobRepository savedRepo,
                                       CompanyRepository companyRepo,
                                       UserRepository userRepo,
                                       MailService mail,
                                       @Value("${app.base-url}") String baseUrl) {
        this.alertRepo = alertRepo;
        this.savedRepo = savedRepo;
        this.companyRepo = companyRepo;
        this.userRepo = userRepo;
        this.mail = mail;
        this.baseUrl = baseUrl;
    }

    @Scheduled(cron = "${app.saved-close-alert-cron:0 0 9 * * *}", zone = "Asia/Seoul")
    public void sendAlerts() {
        List<SavedJobCloseAlertEntity> subs = alertRepo.findByNotifyTrue();
        if (subs.isEmpty()) return;
        int sent = 0;
        for (SavedJobCloseAlertEntity s : subs) {
            try {
                if (processOne(s)) sent++;
            } catch (Exception e) {
                log.warn("saved-close alert 실패 (user={}): {}", s.getUserId(), e.toString());
            }
        }
        log.info("saved-close alert 배치 완료: {}/{} 유저 발송", sent, subs.size());
    }

    private boolean processOne(SavedJobCloseAlertEntity s) {
        List<JobEntity> closed = savedRepo.findClosedUnnotifiedByUser(s.getUserId());
        if (closed.isEmpty()) return false;

        String email = userRepo.findById(s.getUserId()).map(UserEntity::getEmail).orElse(null);
        if (email == null) return false;

        mail.sendSearchDigest(email,
            "[DevPass] 저장하신 공고 " + closed.size() + "건이 마감됐어요",
            buildBody(s, closed));
        savedRepo.markClosedNotified(s.getUserId(), closed.stream().map(JobEntity::getId).toList());
        return true;
    }

    private String buildBody(SavedJobCloseAlertEntity s, List<JobEntity> jobs) {
        Map<String, String> names = companyRepo
            .findAllById(jobs.stream().map(JobEntity::getCompanySlug).distinct().toList())
            .stream()
            .collect(Collectors.toMap(CompanyEntity::getSlug, CompanyEntity::getDisplayName, (a, b) -> a));

        StringBuilder b = new StringBuilder();
        b.append("저장하신 공고 ").append(jobs.size()).append("건이 마감됐어요. 지원 계획에서 정리해 주세요.\n\n");
        for (JobEntity j : jobs.stream().limit(MAX_JOBS_PER_MAIL).toList()) {
            String company = names.getOrDefault(j.getCompanySlug(), j.getCompanySlug());
            b.append("· ").append(TitleLocalizer.localize(j.getTitle()))
                .append(" — ").append(company).append("\n");
        }
        if (jobs.size() > MAX_JOBS_PER_MAIL) {
            b.append("… 외 ").append(jobs.size() - MAX_JOBS_PER_MAIL).append("건\n");
        }
        b.append("\n북마크 정리하러 가기: ").append(baseUrl).append("/bookmarks\n");
        b.append("\n---\n이 알림 그만 받기: ")
            .append(baseUrl).append("/api/alerts/unsubscribe-saved?token=").append(s.getUnsubscribeToken())
            .append("\n");
        return b.toString();
    }
}
