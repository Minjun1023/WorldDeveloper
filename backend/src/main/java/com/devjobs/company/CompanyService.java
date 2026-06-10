package com.devjobs.company;

import com.devjobs.company.dto.CompanyDtos.CompanyDetail;
import com.devjobs.company.dto.CompanyDtos.CompanyListResponse;
import com.devjobs.company.dto.CompanyDtos.CompanySummary;
import com.devjobs.domain.CompanyEntity;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class CompanyService {

    private final CompanyRepository repository;

    public CompanyService(CompanyRepository repository) {
        this.repository = repository;
    }

    public CompanyListResponse list(String tag) {
        List<Object[]> rows = repository.findWithJobCount(tag);
        List<String> slugs = rows.stream().map(r -> (String) r[0]).toList();
        Map<String, CompanyEntity> bySlug = repository.findAllById(slugs).stream()
            .collect(Collectors.toMap(CompanyEntity::getSlug, c -> c));

        // 큐레이션 태그가 빈 회사는 공고 기술태그 상위 4개로 파생(빈 슬러그만 1쿼리로 일괄 조회).
        List<String> needDerived = slugs.stream().filter(s -> {
            CompanyEntity c = bySlug.get(s);
            return c == null || c.getTags() == null || c.getTags().isEmpty();
        }).toList();
        Map<String, List<String>> derivedTags = needDerived.isEmpty()
            ? Map.of()
            : repository.findTopJobTagsForSlugs(needDerived, 4).stream()
                .collect(Collectors.groupingBy(
                    r -> (String) r[0],
                    Collectors.mapping(r -> (String) r[1], Collectors.toList())));

        // 카드 위치 폴백: 회사별 대표 공고 위치(최빈값). 웹은 프로필 ?? 정적맵 ?? 이 값 순으로 쓴다.
        Map<String, String> derivedLocations = slugs.isEmpty()
            ? Map.of()
            : repository.findTopJobLocationForSlugs(slugs).stream()
                .collect(Collectors.toMap(r -> (String) r[0], r -> (String) r[1]));

        List<CompanySummary> items = rows.stream().map(r -> {
            String slug = (String) r[0];
            long count = ((Number) r[1]).longValue();
            boolean verified = r[2] != null && (Boolean) r[2];
            CompanyEntity c = bySlug.get(slug);
            List<String> curated = c != null ? c.getTags() : null;
            List<String> tags = (curated != null && !curated.isEmpty())
                ? curated
                : derivedTags.getOrDefault(slug, List.of());
            return new CompanySummary(
                slug,
                c != null ? c.getDisplayName() : slug,
                tags,
                count,
                c != null ? c.getWebsiteUrl() : null,
                verified,
                derivedLocations.get(slug));
        }).toList();

        return new CompanyListResponse(items.size(), items);
    }

    public Optional<CompanyDetail> detail(String slug) {
        return repository.findById(slug).map(c -> new CompanyDetail(
            c.getSlug(),
            c.getDisplayName(),
            c.getAts(),
            c.getTags(),
            c.getWebsiteUrl(),
            repository.countActiveJobs(slug)));
    }
}
