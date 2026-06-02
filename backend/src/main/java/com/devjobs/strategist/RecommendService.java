package com.devjobs.strategist;

import com.devjobs.domain.JobEntity;
import com.devjobs.scout.JobRepository;
import com.devjobs.scout.JobService;
import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import com.devjobs.strategist.dto.RecommendDtos.RecommendResponse;
import com.devjobs.strategist.dto.RecommendDtos.RecommendationItem;
import com.devjobs.strategist.dto.RecommendDtos.ScoreBreakdown;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class RecommendService {

    private static final int CANDIDATE_POOL = 50;
    // 원격 viable(worldwide/apac_ok) 보강 후보 수. worldwide+apac 총량이 작아 전량을 유사도순
    // 으로 끌어와 일반 풀에 병합 → 잘 매칭되면 추천에 노출(점수/정렬/다양성이 최종 선별).
    private static final int REMOTE_VIABLE_POOL = 25;

    private final JobRepository jobRepository;
    private final JobService jobService;
    private final JobScorer scorer;
    private final AiClient aiClient;

    public RecommendService(JobRepository jobRepository, JobService jobService,
                            JobScorer scorer, AiClient aiClient) {
        this.jobRepository = jobRepository;
        this.jobService = jobService;
        this.scorer = scorer;
        this.aiClient = aiClient;
    }

    public RecommendResponse recommend(RecommendRequest req) {
        int topK = req.topK() != null ? req.topK() : 10;
        int maxPerCompany = req.maxPerCompany() != null ? req.maxPerCompany() : 2;

        // 1. 사용자 프로필 텍스트 → 임베딩
        String profileText = buildProfileText(req);
        List<Double> vec = profileText.isBlank() ? null : aiClient.embed(profileText);

        // 2. 후보 + semantic (pgvector, 실패 시 최신순 fallback)
        List<Object[]> rows;
        List<Object[]> remoteRows = List.of();
        if (vec != null && !vec.isEmpty() && !isZero(vec)) {
            String vecLit = toVectorLiteral(vec);
            rows = jobRepository.findSemanticCandidates(vecLit, CANDIDATE_POOL);
            // 원격 viable 보강 — 일반 풀에서 밀려 안 뜨던 worldwide/apac_ok 원격에 노출 기회.
            remoteRows = jobRepository.findSemanticRemoteViableCandidates(vecLit, REMOTE_VIABLE_POOL);
        } else {
            // 임베딩 없음/ai 다운 → 최신순 fallback. 이 모드에서도 원격 viable 을 따로 주입해 recall 유지.
            rows = jobRepository.findRecentCandidates(CANDIDATE_POOL);
            remoteRows = jobRepository.findRecentRemoteViableCandidates(REMOTE_VIABLE_POOL);
        }

        // 두 풀을 id 기준 병합(dedupe). putIfAbsent 가 null 반환 = 신규 id → ids 에 1회만 추가.
        Map<String, Double> semanticById = new HashMap<>();
        List<String> ids = new ArrayList<>();
        for (Object[] row : rows) {
            String id = (String) row[0];
            if (semanticById.putIfAbsent(id, ((Number) row[1]).doubleValue()) == null) {
                ids.add(id);
            }
        }
        for (Object[] row : remoteRows) {
            String id = (String) row[0];
            if (semanticById.putIfAbsent(id, ((Number) row[1]).doubleValue()) == null) {
                ids.add(id);
            }
        }

        // 3. Entity 조회 + 점수화
        Map<String, JobEntity> jobsById = jobRepository.findAllById(ids).stream()
            .collect(Collectors.toMap(JobEntity::getId, j -> j));

        List<RecommendationItem> scored = new ArrayList<>();
        for (String id : ids) {
            JobEntity job = jobsById.get(id);
            if (job == null) continue;
            ScoreBreakdown sb = scorer.score(job, req, semanticById.getOrDefault(id, 0.0));
            scored.add(new RecommendationItem(jobService.toDto(job), sb));
        }

        // 4. 정렬 + 다양성 제약 + top_k
        scored.sort(Comparator.comparingDouble(
            (RecommendationItem it) -> it.score().finalScore()).reversed());

        List<RecommendationItem> selected = applyDiversity(scored, topK, maxPerCompany);

        return new RecommendResponse(scored.size(), selected.size(), selected);
    }

    private List<RecommendationItem> applyDiversity(
            List<RecommendationItem> scored, int topK, int maxPerCompany) {
        Map<String, Integer> companyCount = new HashMap<>();
        List<RecommendationItem> chosen = new ArrayList<>();
        for (RecommendationItem it : scored) {
            String company = it.job().company() != null ? it.job().company().slug() : "";
            int count = companyCount.getOrDefault(company, 0);
            if (count >= maxPerCompany) continue;
            chosen.add(it);
            companyCount.put(company, count + 1);
            if (chosen.size() >= topK) break;
        }
        return chosen;
    }

    private String buildProfileText(RecommendRequest req) {
        StringBuilder sb = new StringBuilder();
        if (req.bio() != null) sb.append(req.bio()).append(' ');
        if (req.resumeText() != null) sb.append(req.resumeText()).append(' ');
        if (req.skills() != null) sb.append(String.join(" ", req.skills()));
        return sb.toString().trim();
    }

    private String toVectorLiteral(List<Double> vec) {
        return "[" + vec.stream().map(String::valueOf).collect(Collectors.joining(",")) + "]";
    }

    private boolean isZero(List<Double> vec) {
        return vec.stream().allMatch(d -> d == 0.0);
    }
}
