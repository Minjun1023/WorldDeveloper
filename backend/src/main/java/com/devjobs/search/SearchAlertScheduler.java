package com.devjobs.search;

import com.devjobs.auth.MailService;
import com.devjobs.auth.UserEntity;
import com.devjobs.auth.UserRepository;
import com.devjobs.scout.JobService;
import com.devjobs.scout.dto.JobDtos.JobDto;
import java.time.OffsetDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 저장 검색 이메일 다이제스트 배치.
 *
 * 매일 KST 오전 9시(기본): notify=true 인 구독마다 last_notified_at 이후 게시된 공고를
 * 조회해 상위 N건을 평문 메일로 발송하고 워터마크를 갱신한다.
 * - 워터마크가 큐를 대신한다: 배치가 중간에 죽어도 재실행 시 미발송 구독만 다시 처리되고,
 *   발송된 구독은 워터마크가 앞으로 가 있어 중복 발송이 없다(구독 단위 멱등).
 * - 신규 0건이면 메일을 보내지 않고 워터마크도 유지 — "새 공고 없음" 스팸을 만들지 않는다.
 * - 배포 전제: 단일 인스턴스. 다중 인스턴스로 확장하면 이 스케줄러가 인스턴스마다 돌아
 *   중복 발송된다 — 그때는 ShedLock 등 분산 락을 이 메서드에 걸어야 한다.
 */
@Component
public class SearchAlertScheduler {

    private static final Logger log = LoggerFactory.getLogger(SearchAlertScheduler.class);
    private static final int MAX_JOBS_PER_MAIL = 10;

    private final SavedSearchRepository repo;
    private final JobService jobService;
    private final UserRepository userRepo;
    private final MailService mail;
    private final String baseUrl;

    public SearchAlertScheduler(SavedSearchRepository repo, JobService jobService,
                                UserRepository userRepo, MailService mail,
                                @Value("${app.base-url}") String baseUrl) {
        this.repo = repo;
        this.jobService = jobService;
        this.userRepo = userRepo;
        this.mail = mail;
        this.baseUrl = baseUrl;
    }

    @Scheduled(cron = "${app.search-alert-cron:0 0 9 * * *}", zone = "Asia/Seoul")
    public void sendDigests() {
        List<SavedSearchEntity> subs = repo.findByNotifyTrue();
        if (subs.isEmpty()) return;
        int sent = 0;
        for (SavedSearchEntity s : subs) {
            try {
                if (processOne(s)) sent++;
            } catch (Exception e) {
                // 구독 하나의 실패(잘못된 params 등)가 배치 전체를 막지 않도록 격리.
                log.warn("search alert 실패 (id={}): {}", s.getId(), e.toString());
            }
        }
        log.info("search alert 배치 완료: {}/{} 구독 발송", sent, subs.size());
    }

    /** 구독 1건 처리. 메일을 보냈으면 true. */
    private boolean processOne(SavedSearchEntity s) {
        OffsetDateTime since = s.getLastNotifiedAt();
        long count = jobService.countMatchesSince(s.getParams(), since);
        if (count == 0) return false;

        SavedSearchParams p = s.getParams();
        List<JobDto> latest = jobService.search(
                p.q(), p.visa(), p.location(), p.remote(), "newest", p.discipline(),
                p.region(), p.track(), p.includeUnclear(), false, null, false, 1, MAX_JOBS_PER_MAIL)
            .items().stream()
            .filter(j -> j.postedAt() != null && j.postedAt().isAfter(since))
            .toList();
        if (latest.isEmpty()) return false;

        String email = userRepo.findById(s.getUserId()).map(UserEntity::getEmail).orElse(null);
        if (email == null) return false;

        mail.sendSearchDigest(email,
            "[WorldDev] '" + s.getLabel() + "' 새 공고 " + count + "건",
            buildBody(s, latest, count));
        s.setLastNotifiedAt(OffsetDateTime.now());
        repo.save(s);
        return true;
    }

    private String buildBody(SavedSearchEntity s, List<JobDto> jobs, long total) {
        StringBuilder b = new StringBuilder();
        b.append("저장하신 검색 '").append(s.getLabel()).append("' 에 새 공고 ")
            .append(total).append("건이 올라왔어요.\n\n");
        for (JobDto j : jobs) {
            String title = j.titleKo() != null ? j.titleKo() : j.title();
            b.append("· ").append(title)
                .append(" — ").append(j.company().displayName());
            if (j.location() != null && !j.location().isBlank()) {
                b.append(" (").append(j.location()).append(")");
            }
            b.append("\n  ").append(baseUrl).append("/jobs/").append(j.id()).append("\n\n");
        }
        if (total > jobs.size()) {
            b.append("… 외 ").append(total - jobs.size()).append("건 더 보기: ")
                .append(baseUrl).append("/search\n\n");
        }
        b.append("---\n이 알림 그만 받기: ")
            .append(baseUrl).append("/api/alerts/unsubscribe?token=").append(s.getUnsubscribeToken())
            .append("\n");
        return b.toString();
    }
}
