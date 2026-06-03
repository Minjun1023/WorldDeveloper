# 회원 프로필 기반 추천 + AI 게이팅 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 추천을 회원 전용으로 게이팅하고, 가입 시 받은 프로필(기술스택·연차·지역·원격선호·연봉; 비자는 항상 true)로 자동 추천한다. 자연어는 회원의 보조 세분화 수단.

**Architecture:** 신규 `user_profiles` 테이블(user 1:1) + 인증 엔드포인트(`/me/profile` GET/PUT, `/recommend/me`). 추천은 기존 `RecommendService`/`RecommendController` 로직과 웹 `ProfileForm`·`RecommendationCard`를 재사용한다. 가입은 register 요청에 선택적 프로필을 실어 계정 생성 시 저장(이메일 인증 전이라 세션이 없으므로). 웹은 세션(`getSession`)으로 비회원/회원+프로필/회원+무프로필 3상태를 분기.

**Tech Stack:** Spring Boot 3.4.1(Java 17, Hibernate 6, Flyway, JPA), Next.js 15(App Router, TS), Postgres(text[]), next-themes/JWT 세션.

**Base branch:** `feat/member-profile-recommend` (origin/main 기반). worktree `/Users/mac/WordDeveloper/wt-profile`.

**검증 방식(프로젝트 실제 패턴):**
- 백엔드: `./gradlew test` (CI 게이트와 동일) + 실행 중 스택(8080/5433)에 **live curl**. 순수 로직은 JUnit(JobScorerTest 류) 추가.
- 웹: `npm run typecheck && npm run lint && npm run build` + Playwright 라이브.
- 명령은 각각 `backend/`, `web/` 디렉터리에서 실행. 백엔드 라이브 검증은 기존 dev 스택(backend 8080, postgres 5433)이 떠 있다는 전제.

**핵심 재사용:** `RecommendService.recommend(RecommendRequest)`, `RecommendRequest` 레코드, `AiClient.parseProfile(text)`, `RateLimiter.tryAcquire(key)`, `@AuthenticationPrincipal String userId`(JWT subject), 웹 `ProfileForm`·`RecommendationCard`·`RecommendProfile` 타입·인증 프록시 라우트 패턴(`app/api/me/applications/route.ts`).

---

## Phase 1 — 백엔드: 프로필 저장 + 엔드포인트 + 추천/me + 게이팅

### Task 1: V11 마이그레이션 (user_profiles)

**Files:**
- Create: `backend/src/main/resources/db/migration/V11__user_profiles.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 회원 프로필 (user 1:1). 추천 스코러 입력 항목. 비자필요는 저장 안 함(항상 true 고정).
CREATE TABLE user_profiles (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    skills              TEXT[]      NOT NULL DEFAULT '{}',
    seniority           TEXT,
    years_experience    INT,
    preferred_locations TEXT[]      NOT NULL DEFAULT '{}',
    remote_preference   TEXT,
    desired_salary_usd  INT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: 마이그레이션 적용 확인**

Run: `cd backend && ./gradlew flywayInfo --no-daemon` (또는 백엔드 재기동 시 Flyway 자동 적용). 없으면 백엔드 부팅으로 적용됨.
Expected: V11 pending→success, `user_profiles` 테이블 생성. 직접 확인:
`docker exec dev-jobs-postgres psql -U devjobs -d devjobs -c "\d user_profiles"` → 컬럼 7개 표시.

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/WordDeveloper/wt-profile
git add backend/src/main/resources/db/migration/V11__user_profiles.sql
git commit -m "feat(db): V11 user_profiles table"
```

---

### Task 2: UserProfileEntity + Repository

**Files:**
- Create: `backend/src/main/java/com/devjobs/profile/UserProfileEntity.java`
- Create: `backend/src/main/java/com/devjobs/profile/UserProfileRepository.java`

- [ ] **Step 1: 엔티티 작성** (text[] 매핑은 JobEntity 패턴 — `@JdbcTypeCode(SqlTypes.ARRAY)`)

```java
package com.devjobs.profile;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "user_profiles")
public class UserProfileEntity {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "text[]")
    private List<String> skills = new ArrayList<>();

    @Column
    private String seniority;

    @Column(name = "years_experience")
    private Integer yearsExperience;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "preferred_locations", columnDefinition = "text[]")
    private List<String> preferredLocations = new ArrayList<>();

    @Column(name = "remote_preference")
    private String remotePreference;

    @Column(name = "desired_salary_usd")
    private Integer desiredSalaryUsd;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    protected UserProfileEntity() {}

    public UserProfileEntity(UUID userId) {
        this.userId = userId;
    }

    public UUID getUserId() { return userId; }
    public List<String> getSkills() { return skills == null ? List.of() : skills; }
    public void setSkills(List<String> v) { this.skills = v; }
    public String getSeniority() { return seniority; }
    public void setSeniority(String v) { this.seniority = v; }
    public Integer getYearsExperience() { return yearsExperience; }
    public void setYearsExperience(Integer v) { this.yearsExperience = v; }
    public List<String> getPreferredLocations() { return preferredLocations == null ? List.of() : preferredLocations; }
    public void setPreferredLocations(List<String> v) { this.preferredLocations = v; }
    public String getRemotePreference() { return remotePreference; }
    public void setRemotePreference(String v) { this.remotePreference = v; }
    public Integer getDesiredSalaryUsd() { return desiredSalaryUsd; }
    public void setDesiredSalaryUsd(Integer v) { this.desiredSalaryUsd = v; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime v) { this.updatedAt = v; }
}
```

- [ ] **Step 2: 리포지토리 작성**

```java
package com.devjobs.profile;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserProfileRepository extends JpaRepository<UserProfileEntity, UUID> {
}
```

- [ ] **Step 3: 컴파일 확인**

Run: `cd backend && ./gradlew compileJava --no-daemon`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/devjobs/profile/UserProfileEntity.java backend/src/main/java/com/devjobs/profile/UserProfileRepository.java
git commit -m "feat(be): UserProfileEntity + repository"
```

---

### Task 3: ProfileDto + ProfileService (매핑 + 추천요청 빌드)

추천요청 빌드 규칙: 비자필요 **항상 true**. note 가 있으면 `AiClient.parseProfile(note)` 결과의 skills/preferred_locations 를 저장 프로필에 **합집합 병합**(중복 제거), 나머지(seniority/연차/연봉)는 note 값이 있으면 우선.

**Files:**
- Create: `backend/src/main/java/com/devjobs/profile/dto/ProfileDto.java`
- Create: `backend/src/main/java/com/devjobs/profile/ProfileService.java`
- Test: `backend/src/test/java/com/devjobs/profile/ProfileServiceTest.java`

- [ ] **Step 1: DTO 작성** (웹↔백엔드 프로필 표현. RecommendProfile 과 동일 필드명, snake_case JSON)

```java
package com.devjobs.profile.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public final class ProfileDto {
    private ProfileDto() {}

    public record Profile(
        List<String> skills,
        String seniority,
        @JsonProperty("years_experience") Integer yearsExperience,
        @JsonProperty("preferred_locations") List<String> preferredLocations,
        @JsonProperty("remote_preference") String remotePreference,
        @JsonProperty("desired_salary_usd") Integer desiredSalaryUsd
    ) {}

    // GET 응답: 프로필 없거나 skills 비면 exists=false
    public record ProfileResponse(boolean exists, Profile profile) {}
}
```

- [ ] **Step 2: 실패 테스트 작성** (순수 로직: 엔티티→RecommendRequest, 비자 true 고정 + note 병합)

`backend/src/test/java/com/devjobs/profile/ProfileServiceTest.java`:
```java
package com.devjobs.profile;

import static org.assertj.core.api.Assertions.assertThat;

import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ProfileServiceTest {

    private UserProfileEntity profile() {
        UserProfileEntity e = new UserProfileEntity(UUID.randomUUID());
        e.setSkills(List.of("python", "django"));
        e.setSeniority("senior");
        e.setYearsExperience(5);
        e.setPreferredLocations(List.of("germany"));
        e.setRemotePreference("any");
        e.setDesiredSalaryUsd(90000);
        return e;
    }

    @Test
    void buildsRequestWithVisaAlwaysTrue() {
        RecommendRequest r = ProfileService.toRecommendRequest(profile(), null);
        assertThat(r.needsVisaSponsorship()).isTrue();
        assertThat(r.skills()).containsExactly("python", "django");
        assertThat(r.preferredLocations()).containsExactly("germany");
        assertThat(r.topK()).isEqualTo(9);
    }

    @Test
    void mergesNoteSkillsAndLocations() {
        var note = new com.devjobs.strategist.AiClient.ParseResult.Profile(
            List.of("go", "python"), null, null, true, List.of("netherlands"), null, null);
        RecommendRequest r = ProfileService.toRecommendRequest(profile(), note);
        assertThat(r.skills()).contains("python", "django", "go");
        assertThat(r.preferredLocations()).contains("germany", "netherlands");
        assertThat(r.needsVisaSponsorship()).isTrue();
    }
}
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd backend && ./gradlew test --tests com.devjobs.profile.ProfileServiceTest --no-daemon`
Expected: FAIL (ProfileService 없음/메서드 미존재로 컴파일 에러).

- [ ] **Step 4: ProfileService 구현**

```java
package com.devjobs.profile;

import com.devjobs.strategist.AiClient;
import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import com.devjobs.profile.dto.ProfileDto;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {

    private final UserProfileRepository repo;

    public ProfileService(UserProfileRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public ProfileDto.ProfileResponse get(UUID userId) {
        Optional<UserProfileEntity> e = repo.findById(userId);
        if (e.isEmpty() || e.get().getSkills().isEmpty()) {
            return new ProfileDto.ProfileResponse(false, null);
        }
        return new ProfileDto.ProfileResponse(true, toDto(e.get()));
    }

    @Transactional
    public void upsert(UUID userId, ProfileDto.Profile p) {
        UserProfileEntity e = repo.findById(userId).orElseGet(() -> new UserProfileEntity(userId));
        e.setSkills(p.skills() == null ? List.of() : p.skills());
        e.setSeniority(p.seniority());
        e.setYearsExperience(p.yearsExperience());
        e.setPreferredLocations(p.preferredLocations() == null ? List.of() : p.preferredLocations());
        e.setRemotePreference(p.remotePreference());
        e.setDesiredSalaryUsd(p.desiredSalaryUsd());
        e.setUpdatedAt(OffsetDateTime.now());
        repo.save(e);
    }

    /** 프로필 있으면 엔티티 반환(skills 비면 empty). */
    @Transactional(readOnly = true)
    public Optional<UserProfileEntity> load(UUID userId) {
        return repo.findById(userId).filter(e -> !e.getSkills().isEmpty());
    }

    private ProfileDto.Profile toDto(UserProfileEntity e) {
        return new ProfileDto.Profile(e.getSkills(), e.getSeniority(), e.getYearsExperience(),
            e.getPreferredLocations(), e.getRemotePreference(), e.getDesiredSalaryUsd());
    }

    /** 저장 프로필(+선택 note 파싱결과)을 RecommendRequest 로. 비자필요 항상 true. */
    public static RecommendRequest toRecommendRequest(UserProfileEntity e, AiClient.ParseResult.Profile note) {
        List<String> skills = union(e.getSkills(), note == null ? null : note.skills());
        List<String> locs = union(e.getPreferredLocations(), note == null ? null : note.preferredLocations());
        String seniority = note != null && note.seniority() != null ? note.seniority() : e.getSeniority();
        Integer years = note != null && note.yearsExperience() != null ? note.yearsExperience() : e.getYearsExperience();
        String remote = note != null && note.remotePreference() != null ? note.remotePreference() : e.getRemotePreference();
        Integer salary = note != null && note.desiredSalaryUsd() != null ? note.desiredSalaryUsd() : e.getDesiredSalaryUsd();
        return new RecommendRequest(
            skills, seniority, years, null, null,
            true,                       // needsVisaSponsorship 항상 true
            locs, remote, salary, null, 9, 2);
    }

    private static List<String> union(List<String> a, List<String> b) {
        LinkedHashSet<String> set = new LinkedHashSet<>(a == null ? List.of() : a);
        if (b != null) set.addAll(b);
        return new ArrayList<>(set);
    }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd backend && ./gradlew test --tests com.devjobs.profile.ProfileServiceTest --no-daemon`
Expected: PASS (2 tests). (RecommendRequest 필드 순서는 `dto/RecommendDtos.java` 와 정확히 일치해야 함: skills, seniority, yearsExperience, bio, resumeText, needsVisaSponsorship, preferredLocations, remotePreference, desiredSalaryUsd, excludedCompanies, topK, maxPerCompany.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/devjobs/profile/ backend/src/test/java/com/devjobs/profile/ProfileServiceTest.java
git commit -m "feat(be): ProfileService + ProfileDto (recommend mapping, visa always true, note merge)"
```

---

### Task 4: ProfileController (GET/PUT /api/v1/me/profile)

**Files:**
- Create: `backend/src/main/java/com/devjobs/profile/ProfileController.java`

- [ ] **Step 1: 컨트롤러 작성** (userId 는 `@AuthenticationPrincipal String` → UUID 변환; TrackerController 패턴)

```java
package com.devjobs.profile;

import com.devjobs.profile.dto.ProfileDto;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me/profile")
public class ProfileController {

    private final ProfileService service;

    public ProfileController(ProfileService service) {
        this.service = service;
    }

    @GetMapping
    public ProfileDto.ProfileResponse get(@AuthenticationPrincipal String userId) {
        return service.get(UUID.fromString(userId));
    }

    @PutMapping
    public ProfileDto.ProfileResponse put(@AuthenticationPrincipal String userId,
                                          @RequestBody ProfileDto.Profile body) {
        UUID id = UUID.fromString(userId);
        service.upsert(id, body);
        return service.get(id);
    }
}
```

- [ ] **Step 2: 컴파일**

Run: `cd backend && ./gradlew compileJava --no-daemon`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/devjobs/profile/ProfileController.java
git commit -m "feat(be): GET/PUT /api/v1/me/profile"
```

---

### Task 5: MeRecommendController (POST /api/v1/recommend/me)

**Files:**
- Create: `backend/src/main/java/com/devjobs/profile/MeRecommendController.java`

- [ ] **Step 1: 컨트롤러 작성** (저장 프로필로 추천, 없으면 409, 선택 note 병합, userId 레이트리밋)

```java
package com.devjobs.profile;

import com.devjobs.strategist.AiClient;
import com.devjobs.strategist.RateLimiter;
import com.devjobs.strategist.RecommendService;
import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import com.devjobs.strategist.dto.RecommendDtos.RecommendResponse;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/recommend/me")
public class MeRecommendController {

    public record MeRecommendRequest(String note) {}

    private final ProfileService profileService;
    private final RecommendService recommendService;
    private final AiClient aiClient;
    private final RateLimiter rateLimiter;

    public MeRecommendController(ProfileService profileService, RecommendService recommendService,
                                 AiClient aiClient, RateLimiter rateLimiter) {
        this.profileService = profileService;
        this.recommendService = recommendService;
        this.aiClient = aiClient;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping
    public ResponseEntity<?> recommend(@AuthenticationPrincipal String userId,
                                       @RequestBody(required = false) MeRecommendRequest req) {
        UUID id = UUID.fromString(userId);
        if (!rateLimiter.tryAcquire("recommend:" + userId)) {
            return ResponseEntity.status(429).header("Retry-After", "3600")
                .body(Map.of("error", "요청이 많아요. 잠시 후 다시 시도해 주세요."));
        }
        var profileOpt = profileService.load(id);
        if (profileOpt.isEmpty()) {
            return ResponseEntity.status(409).body(Map.of("needs_profile", true,
                "error", "프로필을 먼저 작성해 주세요."));
        }
        AiClient.ParseResult.Profile note = null;
        String noteText = req == null ? null : req.note();
        if (noteText != null && !noteText.isBlank()) {
            AiClient.ParseResult parsed = aiClient.parseProfile(noteText);
            if (parsed != null) note = parsed.profile();
        }
        RecommendRequest rr = ProfileService.toRecommendRequest(profileOpt.get(), note);
        RecommendResponse rec = recommendService.recommend(rr);
        return ResponseEntity.ok(rec);
    }
}
```

- [ ] **Step 2: 컴파일** + RecommendResponse import 경로 확인

Run: `cd backend && ./gradlew compileJava --no-daemon`
Expected: BUILD SUCCESSFUL. (RecommendResponse 가 `dto/RecommendDtos.java` 에 있는지 확인 — `RecommendController` 의 import 와 동일하게.)

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/devjobs/profile/MeRecommendController.java
git commit -m "feat(be): POST /api/v1/recommend/me (profile-based + optional note, userId rate limit)"
```

---

### Task 6: SecurityConfig — /me/** 및 /recommend/me 인증 필수

**Files:**
- Modify: `backend/src/main/java/com/devjobs/config/SecurityConfig.java`

- [ ] **Step 1: 현재 authorizeHttpRequests 읽기**

Run: `grep -n "authorizeHttpRequests\|requestMatchers\|permitAll\|authenticated\|/api/v1/applications" backend/src/main/java/com/devjobs/config/SecurityConfig.java`
기존에 `/api/v1/applications/**` 가 `authenticated()` 인 줄을 찾는다.

- [ ] **Step 2: 인증 경로 추가**

`/api/v1/applications/**` 를 authenticated 로 지정하는 `requestMatchers(...)` 에 `"/api/v1/me/**"`, `"/api/v1/recommend/me"` 를 함께 추가한다. 예(실제 코드에 맞춰 패턴만 추가):
```java
.requestMatchers("/api/v1/applications/**", "/api/v1/me/**", "/api/v1/recommend/me").authenticated()
```
주의: 와일드카드 매칭 순서상 `/api/v1/recommend/**` 가 permitAll 로 먼저 잡히지 않도록, `/api/v1/recommend/me` 의 authenticated 규칙이 더 구체적/우선이어야 한다. 기존에 `/api/v1/recommend/**` permitAll 규칙이 있으면, `/api/v1/recommend/me` authenticated 를 그 **앞에** 둔다(Spring Security 는 먼저 매칭되는 규칙 적용).

- [ ] **Step 3: 컴파일 + 라이브 인증 검증**

Run: `cd backend && ./gradlew build --no-daemon` (테스트 포함)
Expected: BUILD SUCCESSFUL.
백엔드 재기동 후 live curl:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/v1/recommend/me   # 비인증 → 401/403
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/v1/me/profile             # 비인증 → 401/403
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8080/api/v1/jobs?pageSize=1"       # 공개 → 200
```
Expected: 처음 둘 401/403, 마지막 200.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/devjobs/config/SecurityConfig.java
git commit -m "feat(be): require auth for /api/v1/me/** and /recommend/me"
```

---

### Task 7: 가입 시 프로필 저장 (register 에 선택적 프로필)

이메일 인증 전이라 세션이 없으므로, 가입 프로필은 register 요청에 함께 실어 계정 생성 시 저장한다.

**Files:**
- Modify: `backend/src/main/java/com/devjobs/auth/dto/AuthDtos.java` (RegisterRequest 에 profile 추가)
- Modify: `backend/src/main/java/com/devjobs/auth/AuthService.java` (register 가 userId 반환)
- Modify: `backend/src/main/java/com/devjobs/auth/AuthController.java` (register 에서 ProfileService.upsert)

- [ ] **Step 1: RegisterRequest 확장**

`AuthDtos.java` 의 `RegisterRequest` 에 선택 프로필 추가:
```java
public record RegisterRequest(String email, String password, String displayName,
                              com.devjobs.profile.dto.ProfileDto.Profile profile) {}
```
(기존 호출부 호환: profile 은 null 허용.)

- [ ] **Step 2: AuthService.register 가 생성된 userId 반환**

`AuthService.register(email, password, displayName)` 의 반환 타입을 `void`→`UUID` 로 변경하고, 생성된 user 의 id 를 반환하도록 수정(내부에서 저장한 UserEntity.getId()). 기존 호출부(AuthController)도 함께 수정(Step 3).

- [ ] **Step 3: AuthController.register 에서 프로필 저장**

`AuthController` 에 `ProfileService` 주입. register 핸들러:
```java
@PostMapping("/register")
public ResponseEntity<Void> register(@RequestBody RegisterRequest r, HttpServletRequest req) {
    rateLimit("register", req);
    UUID userId = auth.register(r.email(), r.password(), r.displayName());
    if (r.profile() != null && r.profile().skills() != null && !r.profile().skills().isEmpty()) {
        profileService.upsert(userId, r.profile());
    }
    return ResponseEntity.accepted().build(); // 기존 반환 상태 유지
}
```
(`auth.register` 반환을 UUID 로 받도록. 기존 응답 상태코드/바디는 그대로 유지 — 기존 코드의 return 형태에 맞춤.)

- [ ] **Step 4: 빌드 + 라이브 검증**

Run: `cd backend && ./gradlew build --no-daemon`
Expected: BUILD SUCCESSFUL.
라이브: 프로필 포함 가입 → user_profiles 에 행 생성 확인:
```bash
curl -s -X POST http://localhost:8080/api/v1/auth/register -H 'content-type: application/json' \
 -d '{"email":"ptest1@example.com","password":"Abcd1234!!","displayName":"ptest1","profile":{"skills":["python","go"],"seniority":"senior","preferred_locations":["germany"],"remote_preference":"any","desired_salary_usd":90000}}'
docker exec dev-jobs-postgres psql -U devjobs -d devjobs -c \
 "select skills,seniority from user_profiles p join users u on u.id=p.user_id where u.email='ptest1@example.com';"
```
Expected: register 2xx, user_profiles 에 `{python,go}` 행. (정리: 테스트 계정은 이후 삭제 가능.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/devjobs/auth/
git commit -m "feat(be): store optional profile at register (pre-verification signup profile)"
```

---

## Phase 2 — 웹: 프로필 입출력 (가입 2단계 + 편집)

### Task 8: 인증 프록시 라우트 /api/me/profile (GET/PUT)

**Files:**
- Create: `web/app/api/me/profile/route.ts`

- [ ] **Step 1: 라우트 작성** (app/api/me/applications/route.ts 패턴 — Bearer 토큰)

```ts
import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await fetch(`${BACKEND_URL}/api/v1/me/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function PUT(req: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await fetch(`${BACKEND_URL}/api/v1/me/profile`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: await req.text(),
    cache: "no-store",
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
```

- [ ] **Step 2: typecheck/lint**

Run: `cd web && npm run typecheck && npm run lint`
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/me/profile/route.ts
git commit -m "feat(web): /api/me/profile auth proxy (GET/PUT)"
```

---

### Task 9: ProfileForm 재사용 — defaultValue prefill + remote 선택 + 지역 매핑

기존 ProfileForm 은 하드코딩 기본값을 가진다. (1) `defaultValue?: RecommendProfile` 로 초기값 주입, (2) remote_preference 를 "any" 고정 대신 select 노출, (3) submit 라벨/스킵을 위한 선택 props 추가. 비자 체크박스는 제거(항상 true).

**Files:**
- Modify: `web/components/recommend/ProfileForm.tsx`

- [ ] **Step 1: 현재 ProfileForm 전체 읽기**

Run: `cat web/components/recommend/ProfileForm.tsx`
필드 상태 초기화와 submit() 의 RecommendProfile 구성, 비자 체크박스 위치 파악.

- [ ] **Step 2: props + 초기값 + remote select + 비자 제거로 수정**

ProfileForm 시그니처를 다음으로:
```tsx
export function ProfileForm({
  onSubmit,
  loading,
  defaultValue,
  submitLabel = "추천 받기",
  secondaryAction,
}: {
  onSubmit: (profile: RecommendProfile) => void;
  loading: boolean;
  defaultValue?: RecommendProfile;
  submitLabel?: string;
  secondaryAction?: React.ReactNode;
}) {
```
- 상태 초기값을 `defaultValue` 에서 파생(없으면 빈/기본):
  - `skills`: `(defaultValue?.skills ?? []).join(", ")` (없으면 "")
  - `seniority`: `defaultValue?.seniority ?? "senior"`
  - `years`: `defaultValue?.years_experience?.toString() ?? ""`
  - `locations`: `(defaultValue?.preferred_locations ?? []).join(", ")`
  - `remote`: `defaultValue?.remote_preference ?? "any"`
  - `salary`: `defaultValue?.desired_salary_usd?.toString() ?? ""`
- **비자 체크박스/`needsVisa` 상태 제거.** submit() 에서 `needs_visa_sponsorship` 는 보내지 않는다(백엔드가 항상 true 고정. /recommend/me 는 무시, 구조화 /recommend 폼은 별도지만 본 폼은 회원 프로필 저장/추천용).
- 연차(years) Input(number), remote select 추가: 옵션 `[{any:"상관없음"},{remote:"원격 선호"},{onsite:"현지 근무(이주)"}]` (value=any/remote/onsite).
- submit() 의 onSubmit payload(RecommendProfile):
```tsx
onSubmit({
  skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
  seniority,
  years_experience: years ? Number(years) : undefined,
  preferred_locations: locations.split(",").map((s) => s.trim()).filter(Boolean),
  remote_preference: remote,
  desired_salary_usd: salary ? Number(salary) : undefined,
});
```
- 제출 버튼 라벨 `{submitLabel}`, 버튼 옆에 `{secondaryAction}` 렌더(스킵 버튼 주입용).

- [ ] **Step 3: 기존 사용처(/recommend page) 호환 확인**

`app/recommend/page.tsx` 가 `<ProfileForm onSubmit loading />` 로 쓰므로 신규 props 는 모두 optional → 호환. (단 이 페이지는 Task 13 에서 회원 프로필 prefill 로 교체됨.)

- [ ] **Step 4: typecheck/lint/build**

Run: `cd web && npm run typecheck && npm run lint && npm run build`
Expected: 통과.

- [ ] **Step 5: Commit**

```bash
git add web/components/recommend/ProfileForm.tsx
git commit -m "feat(web): ProfileForm defaultValue prefill + remote select; drop visa checkbox"
```

---

### Task 10: 가입 2단계 — 계정 생성 후 스킵 가능 프로필 단계

register 성공 시(이메일 인증 안내 전) 프로필 입력 단계를 보여주고, 프로필을 register 요청에 포함해 보낸다. 즉 register 호출을 "프로필 단계 제출 시"로 미루고, 스킵 시 프로필 없이 register.

**구현 방식:** CredentialsForm 의 register 흐름을 2-스텝으로. step "account"(현재 입력) → "account" 검증 통과 후 step "profile"(ProfileForm + 건너뛰기) → 둘 중 어느 쪽이든 `/api/auth/register` 를 호출(프로필 포함/미포함) → 성공 시 기존 "인증 메일 안내" 표시.

**Files:**
- Modify: `web/components/auth/CredentialsForm.tsx`

- [ ] **Step 1: register 제출 함수 분리**

`/api/auth/register` 호출을 `doRegister(profile?: RecommendProfile)` 로 추출:
```tsx
async function doRegister(profile?: RecommendProfile) {
  setLoading(true); setError(null);
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, display_name: displayName.trim(), profile: profile ?? null }),
    });
    if (!res.ok) throw new Error("가입에 실패했어요. 입력을 확인해 주세요.");
    setRegistered(true);
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  } finally {
    setLoading(false);
  }
}
```
(`/api/auth/register` route 는 body 를 그대로 백엔드로 전달하므로 profile 필드가 함께 감 — Task 7 의 백엔드가 처리.)

- [ ] **Step 2: register 모드에 step 상태 추가**

`const [regStep, setRegStep] = useState<"account" | "profile">("account");`
- register 모드 submit 핸들러: 현재 account 검증(이름/이메일/비번/약관) 통과 시 `setRegStep("profile")` (아직 register 호출 안 함).
- account step 의 제출 버튼 라벨을 "다음"으로(register 모드 한정).

- [ ] **Step 3: profile step 렌더**

register 모드 && regStep==="profile" && !registered 일 때:
```tsx
<div className="space-y-3">
  <p className="text-body-sm text-muted-foreground">맞춤 공고 추천을 위한 프로필 (선택 — 건너뛰어도 가입돼요)</p>
  <ProfileForm
    loading={loading}
    submitLabel="가입 완료"
    onSubmit={(profile) => doRegister(profile)}
    secondaryAction={
      <button type="button" onClick={() => doRegister(undefined)} className="text-body-sm text-muted-foreground hover:text-foreground">
        건너뛰기
      </button>
    }
  />
</div>
```
(`import { ProfileForm }` 및 `RecommendProfile` 타입 추가.)

- [ ] **Step 4: typecheck/lint/build**

Run: `cd web && npm run typecheck && npm run lint && npm run build`
Expected: 통과.

- [ ] **Step 5: Commit**

```bash
git add web/components/auth/CredentialsForm.tsx
git commit -m "feat(web): 2-step signup with skippable profile step (profile sent in register)"
```

---

### Task 11: /me/profile 편집 페이지 + 계정메뉴 링크

**Files:**
- Create: `web/app/me/profile/page.tsx`
- Create: `web/components/profile/ProfileEditor.tsx` (client: load→form→save)
- Modify: `web/components/auth/AccountMenu.tsx` ("내 프로필" 링크)

- [ ] **Step 1: ProfileEditor (client) 작성**

`web/components/profile/ProfileEditor.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";

import { ProfileForm } from "@/components/recommend/ProfileForm";
import type { RecommendProfile } from "@/lib/types";

export function ProfileEditor() {
  const [loaded, setLoaded] = useState<RecommendProfile | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.exists && d.profile) setLoaded(d.profile); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  async function save(profile: RecommendProfile) {
    setSaving(true); setSaved(false); setError(null);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error(`저장 실패 (HTTP ${res.status})`);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <p className="text-body-sm text-muted-foreground">불러오는 중…</p>;
  return (
    <div className="space-y-3">
      <ProfileForm onSubmit={save} loading={saving} defaultValue={loaded} submitLabel="저장" />
      {saved && <p className="text-body-sm text-success">저장됐어요.</p>}
      {error && <p className="text-body-sm text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: /me/profile 페이지** (middleware 가 /me/* 인증 보호 — 비로그인은 /signin 리다이렉트)

`web/app/me/profile/page.tsx`:
```tsx
import { ProfileEditor } from "@/components/profile/ProfileEditor";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section>
        <h1 className="text-display">내 프로필</h1>
        <p className="mt-2 text-muted-foreground">
          기술스택·경력·선호 조건을 저장하면 맞춤 공고 추천에 쓰여요. (비자 스폰서십은 기본 포함)
        </p>
      </section>
      <ProfileEditor />
    </div>
  );
}
```

- [ ] **Step 3: AccountMenu 에 "내 프로필" 링크 추가**

`AccountMenu.tsx` 의 로그인 메뉴에서 "내 지원"(/me/applications) 옆/위에 추가:
```tsx
<Link href="/me/profile" role="menuitem" className="block rounded-md px-3 py-2 text-body-sm text-muted-foreground hover:bg-muted hover:text-foreground">
  내 프로필
</Link>
```
(기존 메뉴 아이템과 동일 className 사용.)

- [ ] **Step 4: typecheck/lint/build**

Run: `cd web && npm run typecheck && npm run lint && npm run build`
Expected: 통과.

- [ ] **Step 5: Commit**

```bash
git add web/app/me/profile/page.tsx web/components/profile/ProfileEditor.tsx web/components/auth/AccountMenu.tsx
git commit -m "feat(web): /me/profile editor page + account menu link"
```

---

## Phase 3 — 웹: AI 추천 게이팅 + 회원 프로필 추천

### Task 12: 인증 프록시 라우트 /api/me/recommend (POST)

**Files:**
- Create: `web/app/api/me/recommend/route.ts`

- [ ] **Step 1: 라우트 작성**

```ts
import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await fetch(`${BACKEND_URL}/api/v1/recommend/me`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: await req.text(),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
```

- [ ] **Step 2: typecheck/lint** → 통과
- [ ] **Step 3: Commit**

```bash
git add web/app/api/me/recommend/route.ts
git commit -m "feat(web): /api/me/recommend auth proxy"
```

---

### Task 13: /recommend 페이지 — 회원 게이팅 3상태

서버 컴포넌트에서 `getSession()` 으로 분기. 비회원 티저 / 회원+프로필 추천 / 회원+무프로필 CTA.

**Files:**
- Modify: `web/app/recommend/page.tsx` (서버 컴포넌트로 전환 + 세션 분기)
- Create: `web/components/recommend/MemberRecommend.tsx` (client: 프로필 추천 + note 세분화)

- [ ] **Step 1: MemberRecommend (client) 작성** — 진입 시 자동 추천, note 세분화, 프로필 없으면 CTA

`web/components/recommend/MemberRecommend.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { RecommendationCard } from "@/components/recommend/RecommendationCard";
import { RecommendationSkeleton } from "@/components/recommend/RecommendationSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RecommendResponse } from "@/lib/types";

export function MemberRecommend() {
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [note, setNote] = useState("");

  async function run(noteText?: string) {
    setLoading(true); setError(null); setNeedsProfile(false);
    try {
      const res = await fetch("/api/me/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: noteText ?? null }),
      });
      if (res.status === 409) { setNeedsProfile(true); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { run(); }, []);

  if (needsProfile) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <p className="text-body-sm text-muted-foreground">프로필을 작성하면 맞춤 공고를 추천해드려요.</p>
        <Link href="/me/profile" className="mt-3 inline-block rounded-md bg-primary px-5 py-2.5 text-body-sm font-medium text-primary-foreground">
          프로필 작성하기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); run(note.trim() || undefined); }} className="flex gap-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="조건 추가(선택): 예) 베를린 우선, 시니어" className="flex-1" />
        <Button type="submit" disabled={loading}>적용</Button>
      </form>
      {loading && <RecommendationSkeleton count={9} message="프로필로 6차원 점수를 계산하는 중…" />}
      {error && <p className="text-body-sm text-destructive">추천 실패: {error}</p>}
      {result && (result.recommendations.length === 0
        ? <p className="text-body-sm text-muted-foreground">조건에 맞는 추천이 없습니다.</p>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.recommendations.map((item, i) => <RecommendationCard key={item.job.id} item={item} rank={i + 1} />)}
          </div>)}
    </div>
  );
}
```

- [ ] **Step 2: /recommend 페이지를 서버 컴포넌트로 전환 + 세션 분기**

`web/app/recommend/page.tsx` 전체 교체:
```tsx
import Link from "next/link";

import { MemberRecommend } from "@/components/recommend/MemberRecommend";
import { getSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export default async function RecommendPage() {
  const session = await getSession();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-display">맞춤 추천</h1>
        <p className="mt-2 text-muted-foreground">
          프로필(기술스택·경력·선호 조건)을 기반으로 6차원 점수(스택·비자·지역·레벨·연봉·의미)로 추천해요.
        </p>
      </section>

      {session ? (
        <MemberRecommend />
      ) : (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <h2 className="text-h3">로그인하고 맞춤 공고 추천 받기</h2>
          <p className="mx-auto mt-2 max-w-md text-body-sm text-muted-foreground">
            가입 시 입력한 프로필로 비자 스폰서 공고를 자동 추천해드려요. 공고 검색은 로그인 없이도 가능합니다.
          </p>
          <Link href="/signin" className="mt-4 inline-block rounded-md bg-primary px-5 py-2.5 text-body-sm font-medium text-primary-foreground">
            로그인 / 회원가입
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: typecheck/lint/build** → 통과
- [ ] **Step 4: Commit**

```bash
git add web/app/recommend/page.tsx web/components/recommend/MemberRecommend.tsx
git commit -m "feat(web): /recommend member-gated (teaser / profile recommend+note / no-profile CTA)"
```

---

### Task 14: 홈 'AI 추천' 탭 게이팅 + 익명 NL 경로 제거

홈 히어로 AI 탭은 비회원에게 티저, 회원에게는 /recommend 로 유도(또는 인라인). 익명 NL(`NlRecommend` + `/api/recommend-nl`) 사용 중단.

**Files:**
- Modify: `web/components/home/HeroSearch.tsx` (AI 탭 콘텐츠 교체)
- Modify: `web/components/home/Hero.tsx` (loggedIn 전달)
- Modify: `web/app/page.tsx` (getSession → Hero 에 loggedIn 전달)

- [ ] **Step 1: page.tsx 에서 세션 → Hero**

`web/app/page.tsx`: 상단에 `import { getSession } from "@/lib/session-server";`, `HomePage` 안에서 `const session = await getSession();` 추가하고 `<Hero ... loggedIn={!!session} />` 로 전달.

- [ ] **Step 2: Hero → HeroSearch 로 loggedIn 전달**

`Hero.tsx`: props 에 `loggedIn: boolean` 추가, `<HeroSearch ... loggedIn={loggedIn} />`. (HERO_PRESETS 는 더 이상 불필요하면 제거 가능 — Step 3 에서 NlRecommend 미사용.)

- [ ] **Step 3: HeroSearch AI 탭을 게이팅 콘텐츠로 교체**

`HeroSearch.tsx`: props 에 `loggedIn?: boolean`. `presets` 제거 가능. AI 탭(`tab === "ai"`) 렌더를 다음으로 교체(NlRecommend 미사용):
```tsx
<div className="rounded-lg border border-border bg-surface p-6 text-center">
  {loggedIn ? (
    <>
      <p className="text-body-sm text-muted-foreground">프로필 기반으로 맞춤 공고를 추천해드려요.</p>
      <Link href="/recommend" className="mt-3 inline-block rounded-md bg-primary px-5 py-2.5 text-body-sm font-medium text-primary-foreground">
        맞춤 추천 보기
      </Link>
    </>
  ) : (
    <>
      <p className="text-body-sm text-muted-foreground">로그인하면 프로필 기반 맞춤 공고 추천을 받을 수 있어요.</p>
      <Link href="/signin" className="mt-3 inline-block rounded-md bg-primary px-5 py-2.5 text-body-sm font-medium text-primary-foreground">
        로그인 / 회원가입
      </Link>
    </>
  )}
</div>
```
(`import Link from "next/link"` 추가. `NlRecommend`·`presets` import/사용 제거.)

- [ ] **Step 4: 익명 NL 경로 정리**

- `web/app/api/recommend-nl/route.ts` 삭제(또는 사용 안 함). `web/components/home/NlRecommend.tsx` 는 다른 사용처 없으면 삭제. 확인: `grep -rln "NlRecommend\|recommend-nl" web/ | grep -v "삭제대상"`.
- 백엔드 `/api/v1/recommend/nl`(NlRecommendController)은 본 플랜에서 제거하지 않고 미사용으로 남겨도 됨(웹에서 호출 안 함). 제거를 원하면 후속.

- [ ] **Step 5: typecheck/lint/build** → 통과 (NlRecommend 삭제 시 import 잔재 없는지 확인)
- [ ] **Step 6: Commit**

```bash
git add web/components/home/HeroSearch.tsx web/components/home/Hero.tsx web/app/page.tsx
git rm web/app/api/recommend-nl/route.ts web/components/home/NlRecommend.tsx 2>/dev/null || true
git commit -m "feat(web): gate home AI tab by login; drop anonymous NL recommend"
```

---

### Task 15: 라이브 통합 검증 (Playwright)

**Files:** 없음(검증만). 기존 dev 스택(web 3000/3100, backend 8080, postgres 5433) + 신규 백엔드(V11 적용·재기동) 필요.

- [ ] **Step 1: 스택 기동** (worktree 격리 dev — backend 재기동으로 V11 적용 + 새 컨트롤러 로드)

worktree 백엔드/웹을 대체 포트로 띄우거나, 기존 dev 스택이 이 브랜치 코드를 서빙하도록 한다. (백엔드는 V11 적용 위해 반드시 이 브랜치로 재기동.)

- [ ] **Step 2: 비회원 게이팅 확인**

Playwright: 비로그인 상태 `/recommend` → "로그인하고 맞춤 공고 추천" 티저 + 로그인 버튼. 홈 AI 탭 → 로그인 유도. `/search` 는 비회원도 정상.

- [ ] **Step 3: 가입 2단계(스킵/저장)**

가입 폼 account 입력→"다음"→프로필 단계. (a) "건너뛰기" → 가입 완료(인증 메일 안내), user_profiles 행 없음. (b) 프로필 입력→"가입 완료" → user_profiles 행 생성(DB 확인).

- [ ] **Step 4: 회원 추천/프로필**

로그인(인증 완료 계정) → `/recommend`: 프로필 있으면 카드 자동 표시 + "조건 추가" note 적용 시 재요청. 프로필 없으면 "프로필 작성하기" CTA. `/me/profile` 에서 수정·저장 후 추천 반영. 계정메뉴 "내 프로필" 링크 동작.

- [ ] **Step 5: 회귀 — 검색/공고 무영향**

`/search`, 홈 검색 탭, 공고 상세 정상.

- [ ] **Step 6: 최종 빌드 게이트**

Run: `cd web && npm run build` && `cd ../backend && ./gradlew build --no-daemon`
Expected: 둘 다 BUILD SUCCESSFUL.

---

## Self-Review 결과

**Spec coverage:**
- user_profiles 테이블 → Task 1 ✅
- GET/PUT /me/profile → Task 4, 8 ✅
- POST /recommend/me (프로필+note, 비자 true, userId 레이트리밋, 409 무프로필) → Task 3·5, 12 ✅
- 익명 /recommend/nl 제거 → Task 14 ✅
- 가입 2단계(스킵) + 프로필 저장(verify 전이라 register 동봉) → Task 7, 10 ✅
- 프로필 편집 페이지 + 계정메뉴 → Task 11 ✅
- AI 게이팅 3상태(비회원 티저/회원+프로필/무프로필 CTA) → Task 13, 14 ✅
- 비자 항상 true(미입력) → ProfileService.toRecommendRequest(Task 3) + ProfileForm 비자 체크박스 제거(Task 9) ✅
- 검색 비회원 유지 → Task 13·14 (검색 탭 무변경) ✅
- 재사용(RecommendService/scorer, RecommendationCard, ProfileForm, 인증프록시) ✅

**Placeholder scan:** 없음(모든 코드 스텝에 실제 코드). 단 SecurityConfig(Task 6)·AuthService/AuthController(Task 7)·ProfileForm(Task 9)은 "현재 코드 읽고 그 패턴에 맞춰 수정" 스텝을 포함 — 정확한 기존 시그니처에 맞추기 위함(추측 코드 방지).

**Type consistency:**
- `RecommendRequest`(skills, seniority, yearsExperience, bio, resumeText, needsVisaSponsorship, preferredLocations, remotePreference, desiredSalaryUsd, excludedCompanies, topK, maxPerCompany) — Task 3 매핑이 이 순서와 일치(검증: dto/RecommendDtos.java) ✅
- `AiClient.ParseResult.Profile`(skills, seniority, yearsExperience, needsVisaSponsorship, preferredLocations, remotePreference, desiredSalaryUsd) — Task 3 note 병합에서 사용 ✅
- `RecommendProfile`(웹 lib/types: skills, seniority, years_experience, preferred_locations, remote_preference, desired_salary_usd …) — ProfileForm/Editor/MemberRecommend 에서 일관 ✅
- `ProfileDto.Profile` snake_case JSON ↔ 웹 RecommendProfile 필드명 일치(skills, years_experience, preferred_locations, remote_preference, desired_salary_usd) ✅
- `@AuthenticationPrincipal String userId` → `UUID.fromString` (Task 4·5·ProfileController/MeRecommendController) ✅

**검증 방식 주의:** 백엔드 controller 통합테스트는 기존 AuthControllerTest 패턴이 있으나, 본 플랜은 순수 매핑은 JUnit(ProfileServiceTest)·엔드포인트는 `./gradlew build`+live curl 로 검증(프로젝트가 라이브 검증을 일관 사용). 필요 시 MockMvc 통합테스트는 후속.
