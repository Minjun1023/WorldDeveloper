package com.devjobs.company;

import com.devjobs.company.dto.CompanyDtos.CompanyDetail;
import com.devjobs.company.dto.CompanyDtos.CompanyListResponse;
import com.devjobs.company.dto.CompanyDtos.CompanySummary;
import com.devjobs.domain.CompanyEntity;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class CompanyService {

    private final CompanyRepository repository;
    private final H1bWageRepository h1bWageRepository;

    public CompanyService(CompanyRepository repository, H1bWageRepository h1bWageRepository) {
        this.repository = repository;
        this.h1bWageRepository = h1bWageRepository;
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

    /**
     * 관심 기업(즐겨찾기) 요약 — 주어진 slug 순서(최신 즐겨찾기순)를 유지해 반환.
     * 활성 공고가 있는 회사는 디렉터리와 동일 요약(공고수·verified·태그·위치)을 쓰고,
     * 활성 공고가 0건인 즐겨찾기도 회사 기본 정보(이름·태그)로 표시한다(jobCount 0).
     * 회사 레코드 자체가 없으면(삭제) 건너뛴다.
     */
    public List<CompanySummary> favorites(List<String> slugs) {
        if (slugs == null || slugs.isEmpty()) return List.of();
        Map<String, CompanySummary> active = list(null).items().stream()
            .collect(Collectors.toMap(CompanySummary::slug, s -> s, (a, b) -> a));
        Map<String, CompanyEntity> entities = repository.findAllById(slugs).stream()
            .collect(Collectors.toMap(CompanyEntity::getSlug, c -> c));
        List<CompanySummary> out = new ArrayList<>();
        for (String slug : slugs) {
            CompanySummary s = active.get(slug);
            if (s != null) {
                out.add(s);
                continue;
            }
            CompanyEntity c = entities.get(slug);
            if (c != null) {
                out.add(new CompanySummary(
                    slug,
                    c.getDisplayName(),
                    c.getTags() != null ? c.getTags() : List.of(),
                    0,
                    c.getWebsiteUrl(),
                    false,
                    null));
            }
        }
        return out;
    }

    public Optional<CompanyDetail> detail(String slug) {
        // LCA 공시 연봉 — 없는 회사가 다수라 null 허용(웹은 null 이면 섹션 생략).
        var wage = h1bWageRepository.findById(slug)
            .map(w -> new com.devjobs.company.dto.CompanyDtos.H1bWage(
                w.getCases(), w.getMedianWage(), w.getP25Wage(), w.getP75Wage(), w.getPeriod()))
            .orElse(null);
        return repository.findById(slug).map(c -> new CompanyDetail(
            c.getSlug(),
            c.getDisplayName(),
            c.getAts(),
            c.getTags(),
            c.getWebsiteUrl(),
            repository.countActiveJobs(slug),
            wage));
    }
}
