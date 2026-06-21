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
import java.util.Comparator;
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

    // 한국어 자유검색어 → 영어 키워드 치환. 공고 제목/설명이 영어라(english tsvector) 한국어로
    // 타이핑하면 0건이던 문제 해결. 긴 키 우선 치환 위해 키 길이 내림차순으로 적용한다.
    private static final List<Map.Entry<String, String>> KO_QUERY_TERMS;
    static {
        Map<String, String> m = new java.util.LinkedHashMap<>();
        // 직무/분야
        m.put("프론트엔드", "frontend"); m.put("프론트", "frontend");
        m.put("백엔드", "backend"); m.put("풀스택", "fullstack");
        m.put("데이터베이스", "database"); m.put("데이터", "data");
        m.put("머신러닝", "machine learning"); m.put("인공지능", "ai"); m.put("딥러닝", "deep learning");
        m.put("데브옵스", "devops"); m.put("인프라", "infrastructure"); m.put("클라우드", "cloud");
        m.put("플랫폼", "platform"); m.put("시스템", "systems"); m.put("네트워크", "network");
        m.put("보안", "security"); m.put("게임", "game"); m.put("블록체인", "blockchain");
        m.put("임베디드", "embedded"); m.put("알고리즘", "algorithm"); m.put("서버", "server");
        m.put("안드로이드", "android"); m.put("아이오에스", "ios"); m.put("모바일", "mobile"); m.put("웹", "web");
        // 언어/기술
        m.put("자바스크립트", "javascript"); m.put("타입스크립트", "typescript"); m.put("자바", "java");
        m.put("파이썬", "python"); m.put("리액트", "react"); m.put("뷰", "vue"); m.put("앵귤러", "angular");
        m.put("노드", "node"); m.put("코틀린", "kotlin"); m.put("스위프트", "swift"); m.put("러스트", "rust");
        m.put("고랭", "golang"); m.put("스칼라", "scala"); m.put("루비", "ruby"); m.put("쿠버네티스", "kubernetes");
        // 레벨
        m.put("시니어", "senior"); m.put("주니어", "junior");
        KO_QUERY_TERMS = m.entrySet().stream()
            .sorted((a, b) -> b.getKey().length() - a.getKey().length())
            .toList();
    }

    // 과도하게 좁히는 일반어(websearch AND 의미라 recall 손해) — 치환 후 제거한다.
    private static final List<String> KO_QUERY_DROP = List.of(
        "개발자", "엔지니어", "채용", "공고", "구인", "구직", "모집", "포지션", "직무", "일자리", "직군");

    /** 한국어 검색어를 영어 키워드로 치환. 알 수 없는 한글 토큰은 제거(0매칭 방지), 전부 비면 원문 유지. */
    static String translateKoreanQuery(String q) {
        if (q == null || q.isBlank()) return q;
        String s = q;
        for (Map.Entry<String, String> e : KO_QUERY_TERMS) {
            s = s.replace(e.getKey(), " " + e.getValue() + " ");
        }
        for (String drop : KO_QUERY_DROP) {
            s = s.replace(drop, " ");
        }
        // 잔여 한글 토큰 제거(영어 코퍼스에 매칭되지 않아 결과를 죽임).
        StringBuilder out = new StringBuilder();
        for (String tok : s.trim().split("\\s+")) {
            if (tok.isBlank() || tok.matches(".*[가-힣ㄱ-ㅎㅏ-ㅣ].*")) continue;
            if (out.length() > 0) out.append(' ');
            out.append(tok);
        }
        String result = out.toString();
        return result.isBlank() ? q.trim() : result;
    }

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
        new Region("italy", "이탈리아", "italy|milan|milano|rome|\\yroma\\y|turin|torino"),
        new Region("austria", "오스트리아", "austria|vienna|wien|graz"),
        new Region("czech", "체코", "czech|prague|praha|brno"),
        new Region("switzerland", "스위스", "switzerland|zurich|zürich|geneva|lausanne|basel"));

    /** 지역 key → location 매칭 regex. 'remote'(또는 미정의 key)는 null. 인기 공고 필터 등에서 재사용. */
    public String regionRegex(String key) {
        if (key == null || key.isBlank()) return null;
        return REGIONS.stream().filter(r -> r.key().equals(key)).map(Region::regex).findFirst().orElse(null);
    }

    // 국가 → 주요 도시. key=지역 파라미터 값(URL), regex=location 매칭(원어/현지표기 별칭 포함).
    // 건수 집계와 도시 선택 검색 모두 같은 regex 를 쓰므로 "표시 건수 == 검색 결과"가 일치한다.
    // 일본은 현지 표기(東京 등)가 다수라 별칭이 없으면 도쿄가 크게 누락된다(146→361).
    private record City(String key, String label, String regex) {}
    private static final Map<String, List<City>> CITIES = Map.ofEntries(
        Map.entry("us", List.of(
            new City("san-francisco", "샌프란시스코", "san francisco"), new City("new-york", "뉴욕", "new york"),
            new City("seattle", "시애틀", "seattle"), new City("austin", "오스틴", "austin"),
            new City("boston", "보스턴", "boston"), new City("los-angeles", "로스앤젤레스", "los angeles"),
            new City("palo-alto", "팔로알토", "palo alto"), new City("mountain-view", "마운틴뷰", "mountain view"),
            new City("san-mateo", "샌머테이오", "san mateo"), new City("chicago", "시카고", "chicago"),
            new City("denver", "덴버", "denver"))),
        Map.entry("japan", List.of(
            new City("tokyo", "도쿄", "tokyo|東京"), new City("osaka", "오사카", "osaka|大阪"),
            // 京都(교토)는 東京都(도쿄도)의 부분문자열이라 행정구 접미사로 한정(오매칭 방지).
            new City("kyoto", "교토", "kyoto|京都府|京都市"), new City("fukuoka", "후쿠오카", "fukuoka|福岡"),
            new City("yokohama", "요코하마", "yokohama|横浜"), new City("nagoya", "나고야", "nagoya|名古屋"))),
        Map.entry("germany", List.of(
            new City("berlin", "베를린", "berlin"), new City("munich", "뮌헨", "munich|münchen"),
            new City("hamburg", "함부르크", "hamburg"), new City("frankfurt", "프랑크푸르트", "frankfurt"),
            new City("cologne", "쾰른", "cologne|köln"), new City("stuttgart", "슈투트가르트", "stuttgart"),
            new City("dusseldorf", "뒤셀도르프", "düsseldorf|dusseldorf"))),
        Map.entry("uk", List.of(
            new City("london", "런던", "london"), new City("manchester", "맨체스터", "manchester"),
            new City("edinburgh", "에든버러", "edinburgh"))),
        Map.entry("netherlands", List.of(
            new City("amsterdam", "암스테르담", "amsterdam"), new City("rotterdam", "로테르담", "rotterdam"),
            new City("utrecht", "위트레흐트", "utrecht"), new City("eindhoven", "에인트호번", "eindhoven"))),
        Map.entry("ireland", List.of(
            new City("dublin", "더블린", "dublin"), new City("cork", "코크", "cork"))),
        Map.entry("canada", List.of(
            new City("toronto", "토론토", "toronto"), new City("vancouver", "밴쿠버", "vancouver"),
            new City("montreal", "몬트리올", "montreal|montréal"), new City("ottawa", "오타와", "ottawa"),
            new City("waterloo", "워털루", "waterloo"))),
        Map.entry("france", List.of(
            new City("paris", "파리", "paris"), new City("lyon", "리옹", "lyon"),
            new City("toulouse", "툴루즈", "toulouse"))),
        Map.entry("spain", List.of(
            new City("madrid", "마드리드", "madrid"), new City("barcelona", "바르셀로나", "barcelona"),
            new City("valencia", "발렌시아", "valencia"))),
        Map.entry("poland", List.of(
            new City("warsaw", "바르샤바", "warsaw|warszawa"), new City("krakow", "크라쿠프", "kraków|krakow"),
            new City("wroclaw", "브로츠와프", "wrocław|wroclaw"), new City("gdansk", "그단스크", "gdańsk|gdansk"))),
        Map.entry("portugal", List.of(
            new City("lisbon", "리스본", "lisbon|lisboa"), new City("porto", "포르투", "porto"))),
        Map.entry("sweden", List.of(
            new City("stockholm", "스톡홀름", "stockholm"), new City("gothenburg", "예테보리", "gothenburg|göteborg"),
            new City("malmo", "말뫼", "malmö|malmo"))),
        Map.entry("denmark", List.of(
            new City("copenhagen", "코펜하겐", "copenhagen|københavn|kobenhavn"),
            new City("aarhus", "오르후스", "aarhus|århus"))),
        Map.entry("italy", List.of(
            // roma 는 Romania 의 부분문자열이라 단어경계(\y)로 한정.
            new City("milan", "밀라노", "milan|milano"), new City("rome", "로마", "rome|\\yroma\\y"),
            new City("turin", "토리노", "turin|torino"))),
        Map.entry("austria", List.of(
            new City("vienna", "빈", "vienna|wien"), new City("graz", "그라츠", "graz"))),
        Map.entry("czech", List.of(
            new City("prague", "프라하", "prague|praha"), new City("brno", "브르노", "brno"))),
        Map.entry("switzerland", List.of(
            new City("zurich", "취리히", "zurich|zürich"), new City("geneva", "제네바", "geneva|genève|geneve"),
            new City("lausanne", "로잔", "lausanne"), new City("basel", "바젤", "basel"))));

    // 도시 key → regex (지역 파라미터에서 도시 선택을 매칭하기 위한 평면 조회).
    private static final Map<String, String> CITY_REGEX = CITIES.values().stream()
        .flatMap(List::stream)
        .collect(java.util.stream.Collectors.toMap(City::key, City::regex, (a, b) -> a));

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

    // 특정 국가의 도시별 활성 공고 건수. 파티션: 공고를 선언 순서(주요 도시 우선)의 첫 매칭 도시
    // 1곳에만 배정 → 도시 합 + '그 외 지역' = 국가 전체와 정확히 일치(예 "Yokohama; Tokyo"는 도쿄로만).
    // 어느 도시에도 안 잡히는 공고(국가 단위/원격/소도시)는 '그 외 지역'으로 묶는다. 건수 0은 제외.
    public List<RegionCount> cityCounts(String countryKey) {
        List<City> cities = CITIES.get(countryKey);
        String countryRegex = REGIONS.stream().filter(r -> r.key().equals(countryKey))
            .findFirst().map(Region::regex).filter(Objects::nonNull).orElse(null);
        if (cities == null || countryRegex == null) {
            return List.of();
        }
        List<RegionCount> rows = new ArrayList<>();
        List<String> assigned = new ArrayList<>(); // 이미 배정된 상위 도시들 — 다음 도시 집계 시 제외
        for (City c : cities) {
            long n = assigned.isEmpty()
                ? repository.countActiveByLocationRegex(c.regex())
                : repository.countActiveByLocationRegexExcluding(c.regex(), String.join("|", assigned));
            if (n > 0) {
                rows.add(new RegionCount(c.key(), c.label(), n));
            }
            assigned.add(c.regex());
        }
        rows.sort(Comparator.comparingLong(RegionCount::count).reversed());
        // '그 외 지역'은 "국가 ∖ 도시"라 단일 location 필터로 정확히 못 잡으므로 value 를 비워
        // 프런트에서 비클릭 정보 행으로 표시(합계 표시는 하되 오해 소지 있는 이동은 막음).
        long other = repository.countActiveByLocationRegexExcluding(countryRegex, String.join("|", assigned));
        if (other > 0) {
            rows.add(new RegionCount("", "그 외 지역", other));
        }
        return rows;
    }

    // 기존 9-arg: 게이트 미적용(includeUnclear=true) 편의 오버로드 — 내부/테스트용.
    public JobListResponse search(
        String q, String visa, String location, Boolean remote, String sort, String discipline,
        String region, int page, int pageSize) {
        return search(q, visa, location, remote, sort, discipline, region, null, true, false, null, false, page, pageSize);
    }

    // search() 와 countMatchesSince() 공유 매핑(정렬 priority 제외).
    private record MappedQuery(String q, String disc, String regionRegex, String visa, String loc,
                               Boolean remote, String gateMode) {}

    private MappedQuery mapQuery(String q, String visa, String location, Boolean remote,
                                 String discipline, String region, String track, boolean includeUnclear) {
        boolean hasQuery = q != null && !q.isBlank();
        String discTerms = discipline == null ? null : DISCIPLINE_TERMS.get(discipline);
        // region: 콤마 구분 다중 지역(예: "us,germany,japan"). 국가들은 각 지역 정규식을 '|'로
        // 결합해 location ~* 에 OR 매칭. 단일 "remote"만 선택 시엔 기존대로 원격 플래그로 처리.
        // (UI는 국가만 다중 선택 — remote 는 근무형태라 제외)
        Boolean remoteParam = remote;
        String regionRegex = null;
        if (region != null && !region.isBlank()) {
            List<String> regexes = new ArrayList<>();
            boolean hasRemote = false;
            int validKeys = 0;
            for (String raw : region.split(",")) {
                String key = raw.trim();
                if (key.isEmpty()) continue;
                validKeys++;
                if ("remote".equals(key)) { hasRemote = true; continue; }
                // 국가 key 면 국가 regex, 아니면 도시 key(예: tokyo) → 도시 regex(별칭 포함).
                String rx = REGIONS.stream().filter(x -> x.key().equals(key)).findFirst()
                    .map(Region::regex).filter(Objects::nonNull).orElse(null);
                if (rx == null) rx = CITY_REGEX.get(key);
                if (rx != null) regexes.add(rx);
            }
            if (!regexes.isEmpty()) {
                regionRegex = String.join("|", regexes);
            } else if (hasRemote && validKeys == 1) {
                remoteParam = Boolean.TRUE;
            }
        }
        String gateMode;
        if (includeUnclear) {
            gateMode = "remote".equals(track) ? "remote_unclear"
                     : "relocation".equals(track) ? "relocation_unclear" : "all";
        } else {
            gateMode = "remote".equals(track) ? "remote"
                     : "relocation".equals(track) ? "relocation" : "both";
        }
        String qParam = hasQuery ? translateKoreanQuery(q.trim()) : null;
        String visaParam = (visa != null && !visa.isBlank()) ? visa.trim() : null;
        String locParam = (location != null && !location.isBlank())
            ? "%" + location.trim().toLowerCase() + "%" : null;
        return new MappedQuery(qParam, discTerms, regionRegex, visaParam, locParam, remoteParam, gateMode);
    }

    public JobListResponse search(
        String q, String visa, String location, Boolean remote, String sort, String discipline,
        String region, String track, boolean includeUnclear, boolean verifiedOnly,
        Integer minSalary, boolean completeOnly, int page, int pageSize) {

        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

        boolean hasQuery = q != null && !q.isBlank();
        MappedQuery m = mapQuery(q, visa, location, remote, discipline, region, track, includeUnclear);

        // 정렬 1순위: remote 트랙이면 원격 티어, 아니면 비자 티어. sort=newest 면 둘 다 끔(순수 최신).
        boolean salarySort = "salary".equals(sort);
        boolean remotePriority = "remote".equals(track) && !"newest".equals(sort) && !salarySort;
        boolean visaPriority = !"newest".equals(sort) && !"remote".equals(track) && !salarySort;
        boolean byRelevance = hasQuery && !"recent".equals(sort) && !"newest".equals(sort) && !salarySort;
        // 완성도 랭킹: 명시적 '최신순(newest)'·'연봉순(salary)' 외에는 완성도 높은 공고를 위로(가점, 숨김 아님).
        boolean completeRank = !salarySort && !"newest".equals(sort);
        int offset = (safePage - 1) * safeSize;

        List<String> ids = repository.searchIds(
            m.q(), m.disc(), m.regionRegex(), m.visa(), m.loc(), m.remote(),
            m.gateMode(), verifiedOnly, minSalary, completeOnly, remotePriority, visaPriority, byRelevance,
            salarySort, completeRank, safeSize, offset);
        long total = repository.countSearch(
            m.q(), m.disc(), m.regionRegex(), m.visa(), m.loc(), m.remote(), m.gateMode(), verifiedOnly,
            minSalary, completeOnly);

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

        boolean hasSalary = j.getSalaryMinUsd() != null || j.getSalaryMaxUsd() != null
            || j.getSalaryMin() != null || j.getSalaryMax() != null;
        SalaryDto salary = hasSalary
            ? new SalaryDto(j.getSalaryMinUsd(), j.getSalaryMaxUsd(),
                            j.getSalaryMin(), j.getSalaryMax(), j.getSalaryCurrency(), j.getSalaryPeriod())
            : null;

        // description(HTML) 우선, 없으면 description_text(plain)
        String description = j.getDescription() != null ? j.getDescription() : j.getDescriptionText();

        return new JobDetailDto(
            j.getId(),
            j.getTitle(),
            TitleLocalizer.localize(j.getTitle()),
            company,
            j.getLocation(),
            LocationLocalizer.localize(j.getLocation()),
            j.getIsRemote(),
            j.getEmploymentType(),
            description,
            j.getApplyUrl(),
            j.getPostedAt(),
            j.getClosesAt(),
            j.getTags(),
            visa,
            remote,
            salary,
            j.getExperienceYears(),
            j.getSeniority());
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

        boolean hasSalary = j.getSalaryMinUsd() != null || j.getSalaryMaxUsd() != null
            || j.getSalaryMin() != null || j.getSalaryMax() != null;
        SalaryDto salary = hasSalary
            ? new SalaryDto(j.getSalaryMinUsd(), j.getSalaryMaxUsd(),
                            j.getSalaryMin(), j.getSalaryMax(), j.getSalaryCurrency(), j.getSalaryPeriod())
            : null;

        return new JobDto(
            j.getId(),
            j.getTitle(),
            TitleLocalizer.localize(j.getTitle()),
            company,
            j.getLocation(),
            LocationLocalizer.localize(j.getLocation()),
            j.getIsRemote(),
            j.getEmploymentType(),
            preview(j.getDescriptionText()),
            j.getApplyUrl(),
            j.getPostedAt(),
            j.getClosesAt(),
            j.getTags(),
            visa,
            remote,
            salary,
            j.getSeniority());
    }

    private String preview(String text) {
        if (text == null) return null;
        return text.length() <= PREVIEW_LEN ? text : text.substring(0, PREVIEW_LEN) + "…";
    }
}
