package com.devjobs.scout;

import com.devjobs.domain.CompanyEntity;
import com.devjobs.domain.JobEntity;
import com.devjobs.scout.dto.JobDtos.CompanyDto;
import com.devjobs.scout.dto.JobDtos.FacetsDto;
import com.devjobs.scout.dto.JobDtos.JobDetailDto;
import com.devjobs.scout.dto.JobDtos.JobDto;
import com.devjobs.scout.dto.JobDtos.JobListResponse;
import com.devjobs.scout.dto.JobDtos.RegionCount;
import com.devjobs.scout.dto.JobDtos.RemoteDto;
import com.devjobs.scout.dto.JobDtos.SalaryDto;
import com.devjobs.scout.dto.JobDtos.VisaDto;
import java.time.OffsetDateTime;
import java.util.ArrayList;
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
        new Region("japan", "일본", "japan|tokyo|osaka|kyoto|fukuoka|yokohama|nagoya|sapporo|kobe|shizuoka|saitama|kawasaki|日本|東京|大阪|京都|横浜|名古屋|静岡|福岡"),
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

    // 기존 9-arg: 게이트 미적용(includeUnclear=true) 편의 오버로드 — 내부/테스트용.
    public JobListResponse search(
        String q, String visa, String location, Boolean remote, String sort, String discipline,
        String region, int page, int pageSize) {
        return search(q, visa, location, remote, sort, discipline, region, null, true, false, page, pageSize);
    }

    // search() 와 countMatchesSince() 공유 매핑(정렬 priority 제외).
    private record MappedQuery(String q, String disc, String regionRegex, String visa, String loc,
                               Boolean remote, String gateMode) {}

    private MappedQuery mapQuery(String q, String visa, String location, Boolean remote,
                                 String discipline, String region, String track, boolean includeUnclear) {
        boolean hasQuery = q != null && !q.isBlank();
        String discTerms = discipline == null ? null : DISCIPLINE_TERMS.get(discipline);
        Region reg = (region == null) ? null
            : REGIONS.stream().filter(x -> x.key().equals(region)).findFirst().orElse(null);
        String regionRegex = (reg != null) ? reg.regex() : null;
        Boolean remoteParam = remote;
        if (reg != null && "remote".equals(reg.key())) remoteParam = Boolean.TRUE;
        String gateMode;
        if (includeUnclear) {
            gateMode = "remote".equals(track) ? "remote_unclear"
                     : "relocation".equals(track) ? "relocation_unclear" : "all";
        } else {
            gateMode = "remote".equals(track) ? "remote"
                     : "relocation".equals(track) ? "relocation" : "both";
        }
        String qParam = hasQuery ? q.trim() : null;
        String visaParam = (visa != null && !visa.isBlank()) ? visa.trim() : null;
        String locParam = (location != null && !location.isBlank())
            ? "%" + location.trim().toLowerCase() + "%" : null;
        return new MappedQuery(qParam, discTerms, regionRegex, visaParam, locParam, remoteParam, gateMode);
    }

    public JobListResponse search(
        String q, String visa, String location, Boolean remote, String sort, String discipline,
        String region, String track, boolean includeUnclear, boolean verifiedOnly, int page, int pageSize) {

        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

        boolean hasQuery = q != null && !q.isBlank();
        MappedQuery m = mapQuery(q, visa, location, remote, discipline, region, track, includeUnclear);

        // 정렬 1순위: remote 트랙이면 원격 티어, 아니면 비자 티어. sort=newest 면 둘 다 끔(순수 최신).
        boolean remotePriority = "remote".equals(track) && !"newest".equals(sort);
        boolean visaPriority = !"newest".equals(sort) && !"remote".equals(track);
        boolean byRelevance = hasQuery && !"recent".equals(sort) && !"newest".equals(sort);
        int offset = (safePage - 1) * safeSize;

        List<String> ids = repository.searchIds(
            m.q(), m.disc(), m.regionRegex(), m.visa(), m.loc(), m.remote(),
            m.gateMode(), verifiedOnly, remotePriority, visaPriority, byRelevance, safeSize, offset);
        long total = repository.countSearch(
            m.q(), m.disc(), m.regionRegex(), m.visa(), m.loc(), m.remote(), m.gateMode(), verifiedOnly);

        Map<String, JobEntity> byId = new HashMap<>();
        for (JobEntity j : repository.findAllById(ids)) byId.put(j.getId(), j);
        List<JobDto> items = ids.stream().map(byId::get).filter(Objects::nonNull).map(this::toDto).toList();
        return new JobListResponse(items, safePage, safeSize, total, computeFacets());
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public long countMatchesSince(com.devjobs.search.SavedSearchParams p, java.time.OffsetDateTime since) {
        MappedQuery m = mapQuery(p.q(), p.visa(), p.location(), p.remote(), p.discipline(),
            p.region(), p.track(), p.includeUnclear());
        return repository.countSearchSince(m.q(), m.disc(), m.regionRegex(), m.visa(), m.loc(),
            m.remote(), m.gateMode(), since);
    }

    /** 주어진 id 목록을 JobDto 로 변환(입력 순서 보존, 노출 대상 공고만, 없는 건 제외). 저장 공고 목록용. */
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<JobDto> byIds(List<String> ids) {
        Map<String, JobEntity> byId = new HashMap<>();
        for (JobEntity j : repository.findAllById(ids)) {
            if (isLive(j)) byId.put(j.getId(), j);
        }
        List<JobDto> out = new ArrayList<>();
        for (String id : ids) {
            JobEntity j = byId.get(id);
            if (j != null) out.add(toDto(j));
        }
        return out;
    }

    public List<JobDto> listByCompany(String slug) {
        return repository.findLiveByCompanySlug(slug)
            .stream().map(this::toDto).toList();
    }

    public Optional<JobDetailDto> findById(String id) {
        return repository.findById(id)
            .filter(JobService::isLive)
            .map(this::toDetailDto);
    }

    // 노출 대상(live) 판정 — 네이티브 쿼리의 closes_at 술어와 동일 기준을 단건/저장목록 경로에도 적용.
    // is_active 이면서 마감일이 없거나(상시채용) 아직 지나지 않은 공고만 true.
    private static boolean isLive(JobEntity j) {
        if (!Boolean.TRUE.equals(j.getIsActive())) return false;
        OffsetDateTime closes = j.getClosesAt();
        return closes == null || closes.isAfter(OffsetDateTime.now());
    }

    // 비자 근거가 정부 공식 명부 대조면 true. ETL reclassify 가 남기는 근거 문자열의 안정적
    // 앵커("Home Office"=UK 스폰서 명부, "USCIS"=US H-1B Data Hub)로 판별 — 언어 무관.
    static boolean isRegisterVerified(List<String> evidence) {
        if (evidence == null) {
            return false;
        }
        // 정부 명부(UK/US/NL) register 단계가 남기는 고유 문구로 판정 — 키워드 evidence 스니펫과
        // 충돌하지 않는 앵커. JobRepository 의 정렬/필터 SQL 과 동일 기준이어야 한다.
        return evidence.stream().anyMatch(e ->
            e != null && (e.contains("스폰서 라이선스")
                || e.contains("Employer Data Hub") || e.contains("erkende referenten")));
    }

    private JobDetailDto toDetailDto(JobEntity j) {
        CompanyEntity c = j.getCompany();
        CompanyDto company = c != null
            ? new CompanyDto(c.getSlug(), c.getDisplayName(), c.getTags())
            : new CompanyDto(j.getCompanySlug(), j.getCompanySlug(), List.of());

        VisaDto visa = new VisaDto(
            j.getVisaStatus() == null ? "unclear" : j.getVisaStatus(),
            j.getVisaEvidence(),
            isRegisterVerified(j.getVisaEvidence()));

        RemoteDto remote = new RemoteDto(j.getRemoteEligibility(), j.getRemoteEvidence());

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
            remote,
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
        Map<String, Long> remoteElig = new LinkedHashMap<>();
        for (Object[] row : repository.countByRemoteEligibility()) {
            remoteElig.put(row[0] == null ? "none" : row[0].toString(), ((Number) row[1]).longValue());
        }
        return new FacetsDto(visa, remote, remoteElig);
    }

    public JobDto toDto(JobEntity j) {
        CompanyEntity c = j.getCompany();
        CompanyDto company = c != null
            ? new CompanyDto(c.getSlug(), c.getDisplayName(), c.getTags())
            : new CompanyDto(j.getCompanySlug(), j.getCompanySlug(), List.of());

        VisaDto visa = new VisaDto(
            j.getVisaStatus() == null ? "unclear" : j.getVisaStatus(),
            j.getVisaEvidence(),
            isRegisterVerified(j.getVisaEvidence()));

        RemoteDto remote = new RemoteDto(j.getRemoteEligibility(), j.getRemoteEvidence());

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
            remote,
            salary);
    }

    private String preview(String text) {
        if (text == null) return null;
        return text.length() <= PREVIEW_LEN ? text : text.substring(0, PREVIEW_LEN) + "…";
    }
}
