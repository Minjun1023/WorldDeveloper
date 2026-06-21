package com.devjobs.popular;

import com.devjobs.domain.JobEntity;
import com.devjobs.popular.PopularJobDtos.PopularJob;
import com.devjobs.scout.JobRepository;
import com.devjobs.scout.JobService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 인기 공고: 라이브 공고를 (선택)지역·직무로 거르고 최근 7일 조회수(job_views) 내림차순으로 정렬.
 * 조회 데이터가 적은 초기에는 동률(0)이 많아 사실상 최신순(posted_at) fallback 으로 동작한다.
 */
@Service
public class PopularJobService {

    @PersistenceContext
    private EntityManager em;
    private final JobRepository jobRepo;
    private final JobService jobService;

    public PopularJobService(JobRepository jobRepo, JobService jobService) {
        this.jobRepo = jobRepo;
        this.jobService = jobService;
    }

    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public List<PopularJob> popular(String region, String functionKey, int limit) {
        String regionRx = jobService.regionRegex(region);
        JobFunction fn = JobFunction.byKey(functionKey);

        StringBuilder sql = new StringBuilder(
            "SELECT j.id, COALESCE(v.cnt, 0) AS vc FROM jobs j "
            + "LEFT JOIN (SELECT job_id, count(*) cnt FROM job_views "
            + "  WHERE created_at > now() - interval '7 days' GROUP BY job_id) v ON v.job_id = j.id "
            + "WHERE j.is_active = true AND (j.closes_at IS NULL OR j.closes_at > now()) "
            + "  AND NOT is_agency(j.company_slug) ");
        if (regionRx != null) sql.append("AND j.location ~* :regionRx ");
        if (fn != null) sql.append("AND (j.title ~* :titleRx OR j.tags && CAST(:tagArr AS text[])) ");
        sql.append("ORDER BY vc DESC, j.posted_at DESC NULLS LAST LIMIT :lim");

        var q = em.createNativeQuery(sql.toString());
        if (regionRx != null) q.setParameter("regionRx", regionRx);
        if (fn != null) {
            q.setParameter("titleRx", fn.titleRegex);
            q.setParameter("tagArr", fn.tagArrayLiteral());
        }
        q.setParameter("lim", limit);

        List<Object[]> rows = q.getResultList();
        List<String> ids = rows.stream().map(r -> (String) r[0]).toList();
        Map<String, JobEntity> byId = jobRepo.findAllById(ids).stream()
            .collect(Collectors.toMap(JobEntity::getId, x -> x));
        List<PopularJob> out = new ArrayList<>();
        for (Object[] r : rows) {
            JobEntity j = byId.get((String) r[0]);
            if (j == null) continue;
            out.add(new PopularJob(jobService.toDto(j), ((Number) r[1]).longValue()));
        }
        return out;
    }
}
