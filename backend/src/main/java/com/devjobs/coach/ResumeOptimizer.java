package com.devjobs.coach;

import com.devjobs.coach.dto.CoachDtos.ReorderedLine;
import com.devjobs.coach.dto.CoachDtos.ResumeOptimizeResponse;
import com.devjobs.domain.JobEntity;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 공고별 이력서 키워드 최적화(휴리스틱) — resume_optimizer.py 포팅.
 * 1) 공고 태그+본문에서 기술 키워드 추출
 * 2) 이력서를 줄 단위로 분리, 줄별 매칭 키워드 수로 점수화
 * 3) 점수 내림차순 재배치 제안 + 누락 키워드 + 강조 키워드 + 자연어 제안
 */
final class ResumeOptimizer {

    private ResumeOptimizer() {}

    private static final Pattern BULLET = Pattern.compile("^[-*•·▪◦●○]+\\s*");
    private static final int MAX_LINES = 20;

    static ResumeOptimizeResponse optimize(JobEntity job, String resumeText) {
        String text = resumeText == null ? "" : resumeText;
        // 공고 키워드 (태그 + 본문)
        Set<String> jobKw = TechExtractor.extract(job.getTags(), job.getDescriptionText());

        String lower = text.toLowerCase();
        Set<String> present = new TreeSet<>();
        for (String k : jobKw) {
            if (lower.contains(k)) present.add(k);
        }
        List<String> missing = jobKw.stream()
            .filter(k -> !present.contains(k))
            .sorted()
            .toList();

        // 줄 단위 분리 + 점수화
        List<String> lines = splitLines(text);
        List<ReorderedLine> scored = new ArrayList<>();
        Map<String, Integer> freq = new LinkedHashMap<>();
        for (String ln : lines) {
            List<String> matched = lineMatches(ln, jobKw);
            scored.add(new ReorderedLine(ln, matched, matched.size()));
            for (String k : matched) freq.merge(k, 1, Integer::sum);
        }

        // 점수 내림차순 (동점은 원래 순서 유지 — stable sort)
        List<ReorderedLine> reordered = scored.stream()
            .sorted(Comparator.comparingInt(ReorderedLine::score).reversed())
            .limit(MAX_LINES)
            .toList();

        // 강조 키워드: 매칭 빈도 상위 5
        List<String> leadWith = freq.entrySet().stream()
            .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
            .limit(5)
            .map(Map.Entry::getKey)
            .toList();

        double matchScore = jobKw.isEmpty() ? 0.0
            : Math.round(((double) present.size() / jobKw.size()) * 1000.0) / 1000.0;

        List<String> suggestions = buildSuggestions(missing, leadWith, scored, freq.isEmpty());

        String companyName = job.getCompany() != null
            ? job.getCompany().getDisplayName() : job.getCompanySlug();

        return new ResumeOptimizeResponse(
            job.getId(),
            job.getTitle(),
            companyName,
            matchScore,
            jobKw.stream().sorted().toList(),
            present.stream().toList(),
            missing,
            leadWith,
            reordered,
            lines.size(),
            suggestions,
            "휴리스틱 키워드 매칭입니다. 실제 경험이 없는 키워드를 억지로 넣지 마세요.");
    }

    private static List<String> splitLines(String text) {
        List<String> out = new ArrayList<>();
        for (String raw : text.split("\\r?\\n")) {
            String s = BULLET.matcher(raw.strip()).replaceFirst("");
            if (s.length() >= 5) out.add(s);
        }
        return out;
    }

    private static List<String> lineMatches(String line, Set<String> keywords) {
        String lower = line.toLowerCase();
        return keywords.stream().filter(lower::contains).sorted().collect(Collectors.toList());
    }

    private static List<String> buildSuggestions(
        List<String> missing, List<String> leadWith, List<ReorderedLine> scored, boolean noMatch) {
        List<String> s = new ArrayList<>();
        if (!missing.isEmpty()) {
            List<String> head = missing.stream().limit(8).toList();
            s.add("공고에 명시됐지만 이력서엔 없는 키워드: " + String.join(", ", head)
                + ". 실제 경험이 있다면 명시하고, 없으면 다른 강점을 강조하세요.");
        }
        if (!leadWith.isEmpty()) {
            s.add("상단 3~5줄에 강조할 키워드: " + String.join(", ", leadWith)
                + ". 이력서 첫 1/3 안에 등장하도록 배치하세요.");
        }
        List<String> topLines = scored.stream()
            .filter(l -> l.score() > 0)
            .limit(3)
            .map(ReorderedLine::line)
            .toList();
        if (!topLines.isEmpty()) {
            s.add("리드 라인 후보 (이력서 첫 부분에 배치 권장): " + String.join(" / ", topLines));
        }
        if (noMatch) {
            s.add("이력서와 공고 키워드 매칭이 거의 없습니다. 이 공고가 본인 프로필과 잘 맞는지 다시 검토하세요.");
        }
        return s;
    }
}
