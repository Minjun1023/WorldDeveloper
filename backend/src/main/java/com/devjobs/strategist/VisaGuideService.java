package com.devjobs.strategist;

import com.devjobs.scout.dto.JobDtos.JobDetailDto;
import com.devjobs.strategist.dto.ApplicationKitDtos.SourceRef;
import com.devjobs.strategist.dto.ApplicationKitDtos.VisaGuideDto;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * 비자 가이드 RAG — 공고 location → 국가 추론, 쿼리 임베딩(ai)으로 visa_guides 의미검색 top-K 회수,
 * ai 합성으로 한국 개발자 스폰서 경로 단락 생성. 출처/면책은 회수 청크에서 결정적으로 부착(날조 방지).
 * 폴백: 국가 미추론/임베딩 실패/회수 0/합성 실패 → null(키트는 규칙 판정만).
 */
@Service
public class VisaGuideService {
    private static final int TOP_K = 4;
    private static final String DISCLAIMER =
        "법률·이민 자문이 아닙니다. %s 기준 정보이며 비자 규정은 자주 바뀝니다. "
        + "지원 전 반드시 공식 사이트에서 최신 내용을 확인하세요.";

    private final AiClient aiClient;
    private final VisaGuideRepository repo;

    public VisaGuideService(AiClient aiClient, VisaGuideRepository repo) {
        this.aiClient = aiClient;
        this.repo = repo;
    }

    /** 가이드 생성. 불가 시 null. */
    public VisaGuideDto buildGuide(JobDetailDto job) {
        String country = CountryResolver.resolve(job.location());
        if (country == null) {
            return null;
        }
        String seniority = job.seniority() == null ? "" : job.seniority();
        String query = "%s work visa sponsorship for %s software engineer from South Korea"
            .formatted(country, seniority);

        List<Double> vec = aiClient.embed(query);
        if (vec == null || vec.isEmpty()) {
            return null;
        }
        List<Object[]> rows = repo.findByCountrySemantic(country, toVectorLiteral(vec), TOP_K);
        if (rows == null || rows.isEmpty()) {
            return null;
        }

        // 회수 행 → ai 청크 페이로드. 행: [content, source_url, retrieved_at, section, title]
        List<Map<String, Object>> chunks = new ArrayList<>();
        for (Object[] r : rows) {
            chunks.add(Map.of(
                "content", str(r[0]),
                "source_url", str(r[1]),
                "retrieved_at", str(r[2]),
                "section", str(r[3])));
        }

        String visaStatus = job.visa() == null || job.visa().status() == null ? "" : job.visa().status();
        Map<String, Object> jobMeta = Map.of(
            "title", job.title() == null ? "" : job.title(),
            "seniority", seniority,
            "location", job.location() == null ? "" : job.location());

        String guide = aiClient.visaGuide(country, visaStatus, jobMeta, chunks);
        if (guide == null || guide.isBlank()) {
            return null;
        }

        // 출처: 회수 청크의 (title, url, retrieved_at) — url 기준 중복 제거(순서 유지).
        // url/date 가 비면(스키마상 NOT NULL 이라 정상 경로엔 없음) 건너뛴다 — LLM 호출 후 parse 크래시 방지.
        List<SourceRef> sources = new ArrayList<>();
        Set<String> seenUrls = new LinkedHashSet<>();
        for (Object[] r : rows) {
            String url = str(r[1]);
            String date = str(r[2]);
            if (url.isBlank() || date.isBlank() || !seenUrls.add(url)) {
                continue;
            }
            sources.add(new SourceRef(str(r[4]), url, LocalDate.parse(date)));
        }
        // 면책: 회수 청크 중 가장 최신 작성일(문자열 YYYY-MM-DD 비교).
        String maxDate = rows.stream().map(r -> str(r[2]))
            .filter(d -> !d.isBlank()).max(String::compareTo).orElse("");
        String disclaimer = DISCLAIMER.formatted(maxDate);

        return new VisaGuideDto(guide, sources, disclaimer);
    }

    private static String str(Object o) {
        return o == null ? "" : o.toString();
    }

    // RecommendService.toVectorLiteral 과 동일 — 공유 유틸 추출은 사용처가 2곳뿐이라 보류(YAGNI).
    private static String toVectorLiteral(List<Double> vec) {
        return "[" + vec.stream().map(String::valueOf).collect(Collectors.joining(",")) + "]";
    }
}
