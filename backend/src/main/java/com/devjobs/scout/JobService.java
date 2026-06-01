package com.devjobs.scout;

import com.devjobs.domain.CompanyEntity;
import com.devjobs.domain.JobEntity;
import com.devjobs.scout.dto.JobDtos.CompanyDto;
import com.devjobs.scout.dto.JobDtos.FacetsDto;
import com.devjobs.scout.dto.JobDtos.JobDetailDto;
import com.devjobs.scout.dto.JobDtos.JobDto;
import com.devjobs.scout.dto.JobDtos.JobListResponse;
import com.devjobs.scout.dto.JobDtos.RegionCount;
import com.devjobs.scout.dto.JobDtos.SalaryDto;
import com.devjobs.scout.dto.JobDtos.VisaDto;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class JobService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int PREVIEW_LEN = 200;

    // 직무 카테고리 → tsquery 토큰(서버 큐레이션, ' | ' OR). 튜닝 가능.
    private static final Map<String, String> DISCIPLINE_TERMS = Map.of(
        "backend", "backend | server | api | spring | django | rails | golang | node",
        "frontend", "frontend | react | vue | angular | svelte",
        "fullstack", "fullstack",
        "mobile", "mobile | ios | android | swift | kotlin | flutter",
        "data-ml", "ml | ai | nlp | scientist | analytics",
        "devops", "devops | sre | kubernetes | infrastructure | terraform | platform");

    private record Region(String key, String label, String regex) {} // regex null = 원격(is_remote)
    private static final List<Region> REGIONS = List.of(
        new Region("remote", "원격", null),
        new Region("us", "미국", "united states|usa|san francisco|new york|san mateo|seattle|austin|boston|los angeles|bay area|mountain view|palo alto|chicago|denver"),
        new Region("germany", "독일", "germany|berlin|munich|münchen|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf"),
        new Region("uk", "영국", "united kingdom|england|london|manchester|edinburgh|scotland"),
        new Region("netherlands", "네덜란드", "netherlands|amsterdam|rotterdam|utrecht|hague|eindhoven"),
        new Region("ireland", "아일랜드", "ireland|dublin|cork"),
        new Region("canada", "캐나다", "canada|toronto|vancouver|montreal|ottawa|waterloo"),
        new Region("france", "프랑스", "france|paris|lyon|toulouse"),
        new Region("spain", "스페인", "spain|madrid|barcelona|valencia"),
        new Region("poland", "폴란드", "poland|warsaw|kraków|krakow|wrocław|wroclaw|gdansk|gdańsk"),
        new Region("portugal", "포르투갈", "portugal|lisbon|lisboa|porto"),
        new Region("sweden", "스웨덴", "sweden|stockholm|gothenburg|göteborg|malmö|malmo"),
        new Region("denmark", "덴마크", "denmark|copenhagen|københavn|kobenhavn|aarhus"),
        new Region("italy", "이탈리아", "italy|milan|milano|rome|roma|turin|torino"),
        new Region("austria", "오스트리아", "austria|vienna|wien|graz"),
        new Region("czech", "체코", "czech|prague|praha|brno"),
        new Region("switzerland", "스위스", "switzerland|zurich|zürich|geneva|lausanne|basel"));

    private final JobRepository repository;

    public JobService(JobRepository repository) {
        this.repository = repository;
    }

    public List<RegionCount> regionCounts() {
        return REGIONS.stream().map(r -> {
            long count = "remote".equals(r.key())
                ? repository.countActiveRemote()
                : repository.countActiveByLocationRegex(r.regex());
            return new RegionCount(r.key(), r.label(), count);
        }).toList();
    }

    public JobListResponse search(
        String q, String visa, String location, Boolean remote, String sort, String discipline,
        String region, int page, int pageSize) {

        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

        boolean hasQuery = q != null && !q.isBlank();
        String discTerms = discipline == null ? null : DISCIPLINE_TERMS.get(discipline);

        Region reg = (region == null) ? null
            : REGIONS.stream().filter(x -> x.key().equals(region)).findFirst().orElse(null);
        String regionRegex = (reg != null) ? reg.regex() : null;    // null for 원격/unknown
        Boolean remoteParam = remote;
        if (reg != null && "remote".equals(reg.key())) {
            remoteParam = Boolean.TRUE;                              // 원격 지역 → remote 필터
        }

        // 비자 우선 티어가 기본. sort=recent 도 티어는 유지(티어 내부에서 최신순). sort=newest 일 때만
        // 티어를 끔 — 홈 "새로 올라온 공고" 순수 최신 쇼케이스 전용.
        boolean visaPriority = !"newest".equals(sort);
        boolean byRelevance = hasQuery && !"recent".equals(sort) && !"newest".equals(sort);
        String qParam = hasQuery ? q.trim() : null;
        String visaParam = (visa != null && !visa.isBlank()) ? visa.trim() : null;
        String locParam = (location != null && !location.isBlank())
            ? "%" + location.trim().toLowerCase() + "%" : null;
        int offset = (safePage - 1) * safeSize;

        List<String> ids = repository.searchIds(
            qParam, discTerms, regionRegex, visaParam, locParam, remoteParam,
            visaPriority, byRelevance, safeSize, offset);
        long total = repository.countSearch(qParam, discTerms, regionRegex, visaParam, locParam, remoteParam);

        Map<String, JobEntity> byId = new HashMap<>();
        for (JobEntity j : repository.findAllById(ids)) byId.put(j.getId(), j);
        List<JobDto> items = ids.stream().map(byId::get).filter(Objects::nonNull).map(this::toDto).toList();
        return new JobListResponse(items, safePage, safeSize, total, computeFacets());
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
            j.getClosesAt(),
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
            j.getClosesAt(),
            j.getTags(),
            visa,
            salary);
    }

    private String preview(String text) {
        if (text == null) return null;
        return text.length() <= PREVIEW_LEN ? text : text.substring(0, PREVIEW_LEN) + "…";
    }
}
