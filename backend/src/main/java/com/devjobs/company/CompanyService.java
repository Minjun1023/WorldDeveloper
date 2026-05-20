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

        List<CompanySummary> items = rows.stream().map(r -> {
            String slug = (String) r[0];
            long count = ((Number) r[1]).longValue();
            CompanyEntity c = bySlug.get(slug);
            return new CompanySummary(
                slug,
                c != null ? c.getDisplayName() : slug,
                c != null ? c.getTags() : List.of(),
                count);
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
