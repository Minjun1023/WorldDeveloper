package com.devjobs.strategist;

import com.devjobs.domain.JobEntity;
import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import com.devjobs.strategist.dto.RecommendDtos.ScoreBreakdown;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * 6차원 점수화 (scorer.py 포팅).
 * salary 는 DB에 USD 정규화돼 있고 semantic 은 pgvector cosine 으로 전달받으므로 단순화.
 */
@Component
public class JobScorer {

    // 기본 가중치 (profile.py ScoringWeights 와 동기화, 합=1.0)
    // 스택 매칭 비중↑(0.35→0.42), 지역 비중↓(0.15→0.08): 약한 스택 매칭이 단지 원격/선호지역
    // 일치만으로 상위에 오던 문제 해소(예: 보안 역할이 Golang 역할보다 위로 뜨던 케이스 역전).
    // 지역의 하드 제약(remote_only·region_restricted)은 별도 deal-breaker 패널티로 여전히 보장됨.
    private static final double W_STACK = 0.42;
    private static final double W_VISA = 0.20;
    private static final double W_LOCATION = 0.08;
    private static final double W_SENIORITY = 0.10;
    private static final double W_SALARY = 0.10;
    private static final double W_SEMANTIC = 0.10;

    public ScoreBreakdown score(JobEntity job, RecommendRequest req, double semantic) {
        boolean needsVisa = Boolean.TRUE.equals(req.needsVisaSponsorship());

        double[] stackRes = scoreStack(req.skills(), job.getTags());
        double stack = stackRes[0];

        double visa = scoreVisa(needsVisa, job.getVisaStatus());
        double location = scoreLocation(req, job);
        String jobLevel = Seniority.detect(job.getTitle(), job.getDescriptionText());
        double seniority = Seniority.fit(req.seniority(), jobLevel);
        double salary = scoreSalary(req.desiredSalaryUsd(), job.getSalaryMaxUsd());

        double raw = W_STACK * stack + W_VISA * visa + W_LOCATION * location
            + W_SENIORITY * seniority + W_SALARY * salary + W_SEMANTIC * semantic;

        // deal-breaker 패널티
        double penalty = 1.0;
        List<String> dealBreakers = new ArrayList<>();
        if (needsVisa && "no_sponsor".equals(job.getVisaStatus())) {
            penalty *= 0.1;
            dealBreakers.add("비자 스폰서십 불가 (사용자 비자 필요)");
        }
        if ("remote_only".equals(req.remotePreference())
                && !isKoreaViableRemote(job.getIsRemote(), job.getRemoteEligibility())) {
            penalty *= 0.2;
            dealBreakers.add("원격 불가 공고 (온사이트·지역제한, 사용자 원격 only)");
        }
        if (req.excludedCompanies() != null && req.excludedCompanies().stream()
                .anyMatch(c -> c != null && c.equalsIgnoreCase(job.getCompanySlug()))) {
            penalty = 0.0;
            dealBreakers.add("제외 회사");
        }

        double finalScore = raw * penalty;

        // reasons
        List<String> reasons = new ArrayList<>();
        if (stack >= 0.7) {
            reasons.add("스택 매칭 " + (int) (stack * 100) + "%");
        }
        if (visa == 1.0 && needsVisa) reasons.add("비자 스폰서십 명시");
        if (location == 1.0) reasons.add("선호 지역 일치");
        if (seniority >= 0.9) reasons.add("시니어리티 일치 (" + jobLevel + ")");
        if (salary == 1.0 && req.desiredSalaryUsd() != null) reasons.add("희망 연봉 이상");
        if (semantic >= 0.5) reasons.add(String.format("의미 유사도 %.2f", semantic));

        return new ScoreBreakdown(
            round(finalScore), round(stack), round(visa), round(location),
            round(seniority), round(salary), round(semantic), round(penalty),
            reasons, dealBreakers);
    }

    private double[] scoreStack(List<String> skills, List<String> jobTags) {
        if (jobTags == null || jobTags.isEmpty()) return new double[]{0.5};
        Set<String> userSet = skills == null ? Set.of()
            : skills.stream().map(String::toLowerCase).collect(Collectors.toSet());
        Set<String> jobSet = jobTags.stream().map(String::toLowerCase).collect(Collectors.toSet());
        long matched = jobSet.stream().filter(userSet::contains).count();
        double ratio = (double) matched / jobSet.size();
        double absBonus = Math.min(1.0, matched / 3.0);
        return new double[]{Math.min(1.0, 0.6 * ratio + 0.4 * absBonus)};
    }

    private double scoreVisa(boolean needsVisa, String status) {
        if (!needsVisa) return 1.0;
        return switch (status == null ? "unclear" : status) {
            case "sponsors" -> 1.0;
            case "no_sponsor" -> 0.0;
            default -> 0.4;
        };
    }

    /**
     * 한국 거주자가 실제로 원격 근무 가능한 공고인가.
     * region_restricted(특정 비-한국 권역 한정) 원격은 한국에서 지원해도 길이 막혀 있으므로
     * 점수상 원격으로 치지 않는다(온사이트와 동급). worldwide/apac_ok 는 한국 포함이라 원격 인정,
     * unclear/null(권역 불명)은 보수적으로 원격 유지(확신 있을 때만 강등 — search 게이트와 동일 철학).
     */
    static boolean isKoreaViableRemote(Boolean isRemote, String remoteEligibility) {
        return Boolean.TRUE.equals(isRemote) && !"region_restricted".equals(remoteEligibility);
    }

    private double scoreLocation(RecommendRequest req, JobEntity job) {
        boolean remote = isKoreaViableRemote(job.getIsRemote(), job.getRemoteEligibility());
        if ("remote_only".equals(req.remotePreference())) {
            return remote ? 1.0 : 0.0;
        }
        List<String> prefs = req.preferredLocations();
        if (prefs == null || prefs.isEmpty()) return 0.7;
        if (remote && prefs.stream().anyMatch(p -> p.toLowerCase().contains("remote"))) return 1.0;
        String loc = job.getLocation() == null ? "" : job.getLocation().toLowerCase();
        for (String p : prefs) {
            String pl = p.toLowerCase().trim();
            // 'remote' 선호는 위 원격-적격 경로에서만 처리 — region_restricted 공고의 location 문자열
            // ("Remote - US")에 'remote' 가 들어있어 매칭되는 것을 막는다.
            if (pl.isBlank() || pl.contains("remote")) continue;
            if (loc.contains(pl)) return 1.0;
        }
        if (remote) return 0.7;
        return 0.2;
    }

    private double scoreSalary(Integer desired, Integer jobMaxUsd) {
        if (desired == null) return 0.7;
        if (jobMaxUsd == null) return 0.6;
        if (jobMaxUsd >= desired) return 1.0;
        return Math.max(0.0, (double) jobMaxUsd / desired);
    }

    private double round(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }
}
