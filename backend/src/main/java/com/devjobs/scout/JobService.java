package com.devjobs.scout;

import com.devjobs.domain.CompanyEntity;
import com.devjobs.domain.JobEntity;
import com.devjobs.scout.dto.JobDtos.CompanyDto;
import com.devjobs.scout.dto.JobDtos.FacetsDto;
import com.devjobs.scout.dto.JobDtos.JobDetailDto;
import com.devjobs.scout.dto.JobDtos.JobDto;
import com.devjobs.scout.dto.JobDtos.JobListResponse;
import com.devjobs.scout.dto.JobDtos.SalaryDto;
import com.devjobs.scout.dto.JobDtos.VisaDto;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

@Service
public class JobService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int PREVIEW_LEN = 200;

    private final JobRepository repository;

    public JobService(JobRepository repository) {
        this.repository = repository;
    }

    public JobListResponse search(
        String q, String visa, String location, Boolean remote, int page, int pageSize) {

        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

        Specification<JobEntity> spec = JobSpecifications.isActive();
        if (q != null && !q.isBlank()) {
            spec = spec.and(JobSpecifications.textQuery(q.trim()));
        }
        if (visa != null && !visa.isBlank()) {
            spec = spec.and(JobSpecifications.visaStatus(visa.trim()));
        }
        if (location != null && !location.isBlank()) {
            spec = spec.and(JobSpecifications.location(location.trim()));
        }
        if (remote != null) {
            spec = spec.and(JobSpecifications.remote(remote));
        }

        Pageable pageable = PageRequest.of(
            safePage - 1, safeSize, Sort.by(Sort.Direction.DESC, "postedAt"));
        Page<JobEntity> result = repository.findAll(spec, pageable);

        List<JobDto> items = result.getContent().stream().map(this::toDto).toList();

        return new JobListResponse(
            items, safePage, safeSize, result.getTotalElements(), computeFacets());
    }

    public List<JobDto> listByCompany(String slug) {
        return repository.findByCompanySlugAndIsActiveTrueOrderByPostedAtDesc(slug)
            .stream().map(this::toDto).toList();
    }

    public Optional<JobDetailDto> findById(String id) {
        return repository.findById(id)
            .filter(j -> Boolean.TRUE.equals(j.getIsActive()))
            .map(this::toDetailDto);
    }

    private JobDetailDto toDetailDto(JobEntity j) {
        CompanyEntity c = j.getCompany();
        CompanyDto company = c != null
            ? new CompanyDto(c.getSlug(), c.getDisplayName(), c.getTags())
            : new CompanyDto(j.getCompanySlug(), j.getCompanySlug(), List.of());

        VisaDto visa = new VisaDto(
            j.getVisaStatus() == null ? "unclear" : j.getVisaStatus(),
            j.getVisaEvidence());

        SalaryDto salary = (j.getSalaryMinUsd() != null || j.getSalaryMaxUsd() != null)
            ? new SalaryDto(j.getSalaryMinUsd(), j.getSalaryMaxUsd())
            : null;

        // description(HTML) 우선, 없으면 description_text(plain)
        String description = j.getDescription() != null ? j.getDescription() : j.getDescriptionText();

        return new JobDetailDto(
            j.getId(),
            j.getTitle(),
            company,
            j.getLocation(),
            j.getIsRemote(),
            j.getEmploymentType(),
            description,
            j.getApplyUrl(),
            j.getPostedAt(),
            j.getTags(),
            visa,
            salary);
    }

    private FacetsDto computeFacets() {
        // MVP: 전체 active 공고의 분포 (필터 연동은 후속)
        Map<String, Long> visa = new LinkedHashMap<>();
        for (Object[] row : repository.countByVisaStatus()) {
            visa.put(row[0] == null ? "unclear" : row[0].toString(), ((Number) row[1]).longValue());
        }
        Map<String, Long> remote = new LinkedHashMap<>();
        for (Object[] row : repository.countByRemote()) {
            String key = Boolean.TRUE.equals(row[0]) ? "true" : "false";
            remote.put(key, ((Number) row[1]).longValue());
        }
        return new FacetsDto(visa, remote);
    }

    public JobDto toDto(JobEntity j) {
        CompanyEntity c = j.getCompany();
        CompanyDto company = c != null
            ? new CompanyDto(c.getSlug(), c.getDisplayName(), c.getTags())
            : new CompanyDto(j.getCompanySlug(), j.getCompanySlug(), List.of());

        VisaDto visa = new VisaDto(
            j.getVisaStatus() == null ? "unclear" : j.getVisaStatus(),
            j.getVisaEvidence());

        SalaryDto salary = (j.getSalaryMinUsd() != null || j.getSalaryMaxUsd() != null)
            ? new SalaryDto(j.getSalaryMinUsd(), j.getSalaryMaxUsd())
            : null;

        return new JobDto(
            j.getId(),
            j.getTitle(),
            company,
            j.getLocation(),
            j.getIsRemote(),
            j.getEmploymentType(),
            preview(j.getDescriptionText()),
            j.getApplyUrl(),
            j.getPostedAt(),
            j.getTags(),
            visa,
            salary);
    }

    private String preview(String text) {
        if (text == null) return null;
        return text.length() <= PREVIEW_LEN ? text : text.substring(0, PREVIEW_LEN) + "…";
    }
}
