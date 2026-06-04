# 랜딩 회원 맞춤 추천 + 피드백 인프라 Implementation Plan (기능 A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로필 기반 추천(기존 `/recommend/me`)을 랜딩 상단 회원 섹션에 노출하고, 저장·반응·노출/클릭/지원 피드백을 백엔드에 수집한다(추후 학습 토대). dislike는 추천에서 제외.

**Architecture:** 추천 엔진 재사용(신규 학습 없음). 백엔드에 "현재상태"(saved_jobs·job_reactions) + "이벤트로그"(recommendation_feedback) 3테이블 + feedback 패키지(엔티티/repo/서비스/컨트롤러). 웹은 랜딩 클라이언트 섹션 + InteractiveJobCard + /me/saved + 인증 프록시.

**Tech Stack:** Spring Boot 3.4(Java17, JPA, Flyway, Testcontainers), Next.js 14(TS, Vitest, Tailwind), Postgres.

명령: 백엔드 `cd backend && ./gradlew ...`, 웹 `cd web && npm run ...`.

---

## 파일 구조

**백엔드 (신규 `com.devjobs.feedback` 패키지):**
- `db/migration/V12__feedback.sql` — 3테이블
- `feedback/SavedJobEntity.java`, `JobReactionEntity.java`, `RecommendationFeedbackEntity.java` + 각 `*Repository.java`
- `feedback/FeedbackService.java` — 토글/upsert/bulk/조회/disliked ids
- `feedback/FeedbackController.java` — `/api/v1/me/{saved,reactions,feedback,interactions}` 라우트
- `feedback/dto/FeedbackDtos.java` — 요청/응답 record
- 수정: `scout/JobService.java`(byIds 추가), `profile/MeRecommendController.java`(dislike 제외)

**웹:**
- `app/api/me/saved/route.ts`(GET) + `app/api/me/saved/[jobId]/route.ts`(PUT/DELETE)
- `app/api/me/reactions/[jobId]/route.ts`(PUT/DELETE), `app/api/me/feedback/route.ts`(POST), `app/api/me/interactions/route.ts`(GET)
- `lib/feedback.ts` + `lib/feedback.test.ts`
- `components/recommend/InteractiveJobCard.tsx` + `.test.tsx`
- `components/home/MemberLandingRecommend.tsx`
- 수정: `app/page.tsx`(섹션), `components/auth/AccountMenu.tsx`(링크)
- `app/me/saved/page.tsx` + `components/saved/SavedJobsList.tsx`

---

### Task 1: V12 마이그레이션

**Files:** Create `backend/src/main/resources/db/migration/V12__feedback.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 회원 피드백 인프라: 현재상태(saved/reactions) + 이벤트로그(recommendation_feedback).
CREATE TABLE saved_jobs (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id     TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_saved_jobs_user ON saved_jobs (user_id, created_at DESC);

CREATE TABLE job_reactions (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id     TEXT NOT NULL,
    reaction   TEXT NOT NULL CHECK (reaction IN ('like','dislike')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, job_id)
);

CREATE TABLE recommendation_feedback (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id     TEXT NOT NULL,
    action     TEXT NOT NULL CHECK (action IN ('impression','click','apply_click')),
    rank       INT,
    score      REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rec_feedback_user ON recommendation_feedback (user_id, created_at DESC);
```

- [ ] **Step 2: 컴파일/마이그레이션 검증** — Run: `cd backend && ./gradlew compileJava --no-daemon` (V12 는 부팅 시 적용; 여기선 빌드만). Expected: BUILD SUCCESSFUL.
- [ ] **Step 3: Commit**
```bash
git add backend/src/main/resources/db/migration/V12__feedback.sql
git commit -m "feat(db): V12 feedback tables (saved_jobs, job_reactions, recommendation_feedback)"
```

---

### Task 2: 엔티티 + 리포지토리

**Files:** Create `backend/src/main/java/com/devjobs/feedback/{SavedJobEntity,JobReactionEntity,RecommendationFeedbackEntity,SavedJobRepository,JobReactionRepository,RecommendationFeedbackRepository}.java`

복합키(user_id, job_id)는 `@IdClass` 로 처리한다.

- [ ] **Step 1: SavedJobEntity + IdClass**

`SavedJobEntity.java`:
```java
package com.devjobs.feedback;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "saved_jobs")
@IdClass(SavedJobEntity.Key.class)
public class SavedJobEntity {
    public static class Key implements Serializable {
        public UUID userId;
        public String jobId;
        public Key() {}
        public Key(UUID userId, String jobId) { this.userId = userId; this.jobId = jobId; }
        @Override public boolean equals(Object o) {
            if (!(o instanceof Key k)) return false;
            return userId.equals(k.userId) && jobId.equals(k.jobId);
        }
        @Override public int hashCode() { return userId.hashCode() * 31 + jobId.hashCode(); }
    }

    @Id @Column(name = "user_id") private UUID userId;
    @Id @Column(name = "job_id") private String jobId;
    @Column(name = "created_at") private OffsetDateTime createdAt;

    protected SavedJobEntity() {}
    public SavedJobEntity(UUID userId, String jobId) {
        this.userId = userId; this.jobId = jobId; this.createdAt = OffsetDateTime.now();
    }
    public UUID getUserId() { return userId; }
    public String getJobId() { return jobId; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
```

- [ ] **Step 2: JobReactionEntity**

`JobReactionEntity.java`:
```java
package com.devjobs.feedback;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "job_reactions")
@IdClass(JobReactionEntity.Key.class)
public class JobReactionEntity {
    public static class Key implements Serializable {
        public UUID userId;
        public String jobId;
        public Key() {}
        public Key(UUID userId, String jobId) { this.userId = userId; this.jobId = jobId; }
        @Override public boolean equals(Object o) {
            if (!(o instanceof Key k)) return false;
            return userId.equals(k.userId) && jobId.equals(k.jobId);
        }
        @Override public int hashCode() { return userId.hashCode() * 31 + jobId.hashCode(); }
    }

    @Id @Column(name = "user_id") private UUID userId;
    @Id @Column(name = "job_id") private String jobId;
    @Column private String reaction; // "like" | "dislike"
    @Column(name = "updated_at") private OffsetDateTime updatedAt;

    protected JobReactionEntity() {}
    public JobReactionEntity(UUID userId, String jobId, String reaction) {
        this.userId = userId; this.jobId = jobId; this.reaction = reaction; this.updatedAt = OffsetDateTime.now();
    }
    public UUID getUserId() { return userId; }
    public String getJobId() { return jobId; }
    public String getReaction() { return reaction; }
    public void setReaction(String reaction) { this.reaction = reaction; this.updatedAt = OffsetDateTime.now(); }
}
```

- [ ] **Step 3: RecommendationFeedbackEntity**

`RecommendationFeedbackEntity.java`:
```java
package com.devjobs.feedback;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "recommendation_feedback")
public class RecommendationFeedbackEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "user_id") private UUID userId;
    @Column(name = "job_id") private String jobId;
    @Column private String action; // impression|click|apply_click
    @Column private Integer rank;
    @Column private Float score;
    @Column(name = "created_at") private OffsetDateTime createdAt;

    protected RecommendationFeedbackEntity() {}
    public RecommendationFeedbackEntity(UUID userId, String jobId, String action, Integer rank, Float score) {
        this.userId = userId; this.jobId = jobId; this.action = action;
        this.rank = rank; this.score = score; this.createdAt = OffsetDateTime.now();
    }
    public Long getId() { return id; }
    public String getJobId() { return jobId; }
    public String getAction() { return action; }
}
```

- [ ] **Step 4: 리포지토리 3종**

`SavedJobRepository.java`:
```java
package com.devjobs.feedback;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavedJobRepository extends JpaRepository<SavedJobEntity, SavedJobEntity.Key> {
    List<SavedJobEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
```

`JobReactionRepository.java`:
```java
package com.devjobs.feedback;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JobReactionRepository extends JpaRepository<JobReactionEntity, JobReactionEntity.Key> {
    List<JobReactionEntity> findByUserId(UUID userId);
    List<JobReactionEntity> findByUserIdAndReaction(UUID userId, String reaction);
}
```

`RecommendationFeedbackRepository.java`:
```java
package com.devjobs.feedback;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RecommendationFeedbackRepository extends JpaRepository<RecommendationFeedbackEntity, Long> {
}
```

- [ ] **Step 5: 빌드** — Run: `cd backend && ./gradlew compileJava --no-daemon` → BUILD SUCCESSFUL.
- [ ] **Step 6: Commit**
```bash
git add backend/src/main/java/com/devjobs/feedback/
git commit -m "feat(be): feedback entities + repositories (saved/reactions/feedback)"
```

---

### Task 3: FeedbackService + DTO (+단위 테스트)

**Files:** Create `feedback/dto/FeedbackDtos.java`, `feedback/FeedbackService.java`; Test `backend/src/test/java/com/devjobs/feedback/FeedbackServiceTest.java`

- [ ] **Step 1: DTO**

`feedback/dto/FeedbackDtos.java`:
```java
package com.devjobs.feedback.dto;

import java.util.List;
import java.util.Map;

public class FeedbackDtos {
    public record ReactionRequest(String reaction) {}
    public record FeedbackEvent(String job_id, String action, Integer rank, Float score) {}
    public record FeedbackBatch(List<FeedbackEvent> events) {}
    public record Interactions(List<String> saved, Map<String, String> reactions) {}
}
```

- [ ] **Step 2: 실패하는 테스트 작성** — `FeedbackServiceTest.java` (Testcontainers 통합; 기존 `AuthControllerTest` 의 `@SpringBootTest`+Testcontainers 패턴을 따른다 — 같은 베이스 설정 재사용)

```java
package com.devjobs.feedback;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.devjobs.feedback.dto.FeedbackDtos.FeedbackEvent;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
class FeedbackServiceTest {

    @Container
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("pgvector/pgvector:pg16");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", pg::getJdbcUrl);
        r.add("spring.datasource.username", pg::getUsername);
        r.add("spring.datasource.password", pg::getPassword);
    }

    @Autowired FeedbackService service;

    private UUID newUser() {
        // users 행이 필요(FK). 테스트 헬퍼: 직접 insert 대신 회원가입 서비스가 있으나
        // 여기선 FK 충족 위해 raw insert. (AuthService 재사용 가능하면 그걸로 대체)
        return service.testInsertUser("fb_" + UUID.randomUUID() + "@example.com");
    }

    @Test
    void saveToggleIsIdempotentAndRemovable() {
        UUID u = newUser();
        service.save(u, "greenhouse:acme:1");
        service.save(u, "greenhouse:acme:1"); // 멱등
        assertEquals(List.of("greenhouse:acme:1"), service.interactions(u).saved());
        service.unsave(u, "greenhouse:acme:1");
        assertTrue(service.interactions(u).saved().isEmpty());
    }

    @Test
    void reactionUpsertAndDislikedIds() {
        UUID u = newUser();
        service.react(u, "j1", "like");
        service.react(u, "j1", "dislike"); // 전환
        service.react(u, "j2", "dislike");
        assertEquals("dislike", service.interactions(u).reactions().get("j1"));
        assertTrue(service.dislikedJobIds(u).containsAll(List.of("j1", "j2")));
        service.clearReaction(u, "j1");
        assertFalse(service.dislikedJobIds(u).contains("j1"));
    }

    @Test
    void feedbackBulkInsertAccepted() {
        UUID u = newUser();
        long n = service.recordEvents(u, List.of(
            new FeedbackEvent("j1", "impression", 1, 0.8f),
            new FeedbackEvent("j2", "click", 2, 0.7f)));
        assertEquals(2, n);
    }

    @Test
    void unknownActionRejected() {
        UUID u = newUser();
        long n = service.recordEvents(u, List.of(new FeedbackEvent("j1", "BOGUS", 1, 0.5f)));
        assertEquals(0, n); // 알 수 없는 action 은 무시(저장 0건)
    }
}
```

- [ ] **Step 3: 실패 확인** — Run: `cd backend && ./gradlew test --no-daemon --tests "com.devjobs.feedback.FeedbackServiceTest"` → FAIL(컴파일 에러: FeedbackService 없음).

- [ ] **Step 4: FeedbackService 구현**

`feedback/FeedbackService.java`:
```java
package com.devjobs.feedback;

import com.devjobs.feedback.dto.FeedbackDtos.FeedbackEvent;
import com.devjobs.feedback.dto.FeedbackDtos.Interactions;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FeedbackService {

    private static final Set<String> VALID_ACTIONS = Set.of("impression", "click", "apply_click");
    private static final int MAX_EVENTS = 100;

    private final SavedJobRepository savedRepo;
    private final JobReactionRepository reactionRepo;
    private final RecommendationFeedbackRepository feedbackRepo;
    private final EntityManager em;

    public FeedbackService(SavedJobRepository savedRepo, JobReactionRepository reactionRepo,
                           RecommendationFeedbackRepository feedbackRepo, EntityManager em) {
        this.savedRepo = savedRepo; this.reactionRepo = reactionRepo;
        this.feedbackRepo = feedbackRepo; this.em = em;
    }

    @Transactional
    public void save(UUID userId, String jobId) {
        if (!savedRepo.existsById(new SavedJobEntity.Key(userId, jobId))) {
            savedRepo.save(new SavedJobEntity(userId, jobId));
        }
    }

    @Transactional
    public void unsave(UUID userId, String jobId) {
        savedRepo.deleteById(new SavedJobEntity.Key(userId, jobId));
    }

    /** 저장 job_id 목록(최신순). */
    @Transactional(readOnly = true)
    public List<String> savedJobIds(UUID userId) {
        return savedRepo.findByUserIdOrderByCreatedAtDesc(userId).stream()
            .map(SavedJobEntity::getJobId).collect(Collectors.toList());
    }

    @Transactional
    public void react(UUID userId, String jobId, String reaction) {
        if (!reaction.equals("like") && !reaction.equals("dislike")) return;
        var existing = reactionRepo.findById(new JobReactionEntity.Key(userId, jobId));
        if (existing.isPresent()) {
            existing.get().setReaction(reaction);
        } else {
            reactionRepo.save(new JobReactionEntity(userId, jobId, reaction));
        }
    }

    @Transactional
    public void clearReaction(UUID userId, String jobId) {
        reactionRepo.deleteById(new JobReactionEntity.Key(userId, jobId));
    }

    @Transactional(readOnly = true)
    public Set<String> dislikedJobIds(UUID userId) {
        return reactionRepo.findByUserIdAndReaction(userId, "dislike").stream()
            .map(JobReactionEntity::getJobId).collect(Collectors.toSet());
    }

    @Transactional(readOnly = true)
    public Interactions interactions(UUID userId) {
        List<String> saved = savedJobIds(userId);
        Map<String, String> reactions = new LinkedHashMap<>();
        for (JobReactionEntity r : reactionRepo.findByUserId(userId)) {
            reactions.put(r.getJobId(), r.getReaction());
        }
        return new Interactions(saved, reactions);
    }

    /** bulk insert. 알 수 없는 action 무시. 상한 초과 시 앞 MAX_EVENTS 만. 저장 건수 반환. */
    @Transactional
    public long recordEvents(UUID userId, List<FeedbackEvent> events) {
        if (events == null) return 0;
        long n = 0;
        for (FeedbackEvent e : events.stream().limit(MAX_EVENTS).toList()) {
            if (e.job_id() == null || !VALID_ACTIONS.contains(e.action())) continue;
            feedbackRepo.save(new RecommendationFeedbackEntity(
                userId, e.job_id(), e.action(), e.rank(), e.score()));
            n++;
        }
        return n;
    }

    /** 테스트 전용: FK 충족용 users 행 생성. */
    @Transactional
    public UUID testInsertUser(String email) {
        UUID id = UUID.randomUUID();
        em.createNativeQuery(
            "INSERT INTO users (id, email, password_hash, display_name, created_at, email_verified_at) "
            + "VALUES (?1, ?2, 'x', ?3, now(), now())")
            .setParameter(1, id).setParameter(2, email).setParameter(3, "fb-" + id.toString().substring(0, 8))
            .executeUpdate();
        return id;
    }
}
```

(주의: `testInsertUser` 는 테스트 편의용 — users 테이블 컬럼명은 V6 마이그레이션에 맞춘다. 구현 시 `users` 실제 컬럼(`password_hash`, `display_name`, `email_verified_at`) 확인. 운영 코드에서 호출 안 함.)

- [ ] **Step 5: 통과 확인** — Run: `cd backend && ./gradlew test --no-daemon --tests "com.devjobs.feedback.FeedbackServiceTest"` → 4 PASS.
- [ ] **Step 6: Commit**
```bash
git add backend/src/main/java/com/devjobs/feedback/ backend/src/test/java/com/devjobs/feedback/FeedbackServiceTest.java
git commit -m "feat(be): FeedbackService (save/react/events/interactions) + tests"
```

---

### Task 4: JobService.byIds (저장 공고 DTO 조회)

**Files:** Modify `backend/src/main/java/com/devjobs/scout/JobService.java`

`/me/saved` 는 저장된 job_id 들을 JobDto 목록으로 반환해야 한다. JobService 에 순서 보존 byIds 를 추가하고, 기존 JobEntity→JobDto 매핑을 재사용한다.

- [ ] **Step 1: 기존 매핑 확인** — `JobService.java` 를 읽어 JobEntity→JobDto 변환 메서드(예 `toDto(JobEntity)` 또는 search 내부 매핑)를 찾는다. 그 매퍼를 재사용한다.

- [ ] **Step 2: byIds 추가** — JobService 에 추가(매퍼 이름은 Step 1 에서 확인한 실제 이름 사용):

```java
/** 주어진 id 목록을 JobDto 로(입력 순서 보존, is_active 만, 없는 건 제외). */
@org.springframework.transaction.annotation.Transactional(readOnly = true)
public java.util.List<com.devjobs.scout.dto.JobDtos.JobDto> byIds(java.util.List<String> ids) {
    java.util.Map<String, com.devjobs.scout.JobEntity> byId = new java.util.HashMap<>();
    for (com.devjobs.scout.JobEntity j : repository.findAllById(ids)) {
        if (j.isActive()) byId.put(j.getId(), j);   // isActive 접근자는 실제 엔티티에 맞춤
    }
    java.util.List<com.devjobs.scout.dto.JobDtos.JobDto> out = new java.util.ArrayList<>();
    for (String id : ids) {
        com.devjobs.scout.JobEntity j = byId.get(id);
        if (j != null) out.add(toDto(j));   // toDto = Step 1 에서 확인한 기존 매퍼
    }
    return out;
}
```

(주의: `repository`·`toDto`·`isActive`·`getId` 는 JobService/JobEntity 의 실제 멤버명에 맞춘다 — Step 1 에서 확인.)

- [ ] **Step 3: 빌드** — `cd backend && ./gradlew compileJava --no-daemon` → SUCCESSFUL.
- [ ] **Step 4: Commit**
```bash
git add backend/src/main/java/com/devjobs/scout/JobService.java
git commit -m "feat(be): JobService.byIds (ordered JobDto fetch for saved list)"
```

---

### Task 5: FeedbackController (saved/reactions/feedback/interactions)

**Files:** Create `backend/src/main/java/com/devjobs/feedback/FeedbackController.java`

- [ ] **Step 1: 컨트롤러 작성**

```java
package com.devjobs.feedback;

import com.devjobs.feedback.dto.FeedbackDtos.FeedbackBatch;
import com.devjobs.feedback.dto.FeedbackDtos.Interactions;
import com.devjobs.feedback.dto.FeedbackDtos.ReactionRequest;
import com.devjobs.scout.JobService;
import com.devjobs.scout.dto.JobDtos.JobDto;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
public class FeedbackController {

    private final FeedbackService feedback;
    private final JobService jobService;

    public FeedbackController(FeedbackService feedback, JobService jobService) {
        this.feedback = feedback;
        this.jobService = jobService;
    }

    private UUID uid(String userId) { return UUID.fromString(userId); }

    @PutMapping("/saved/{jobId}")
    public ResponseEntity<Void> save(@AuthenticationPrincipal String userId, @PathVariable String jobId) {
        feedback.save(uid(userId), jobId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/saved/{jobId}")
    public ResponseEntity<Void> unsave(@AuthenticationPrincipal String userId, @PathVariable String jobId) {
        feedback.unsave(uid(userId), jobId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/saved")
    public List<JobDto> saved(@AuthenticationPrincipal String userId) {
        return jobService.byIds(feedback.savedJobIds(uid(userId)));
    }

    @PutMapping("/reactions/{jobId}")
    public ResponseEntity<Void> react(@AuthenticationPrincipal String userId, @PathVariable String jobId,
                                      @RequestBody ReactionRequest req) {
        feedback.react(uid(userId), jobId, req.reaction());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/reactions/{jobId}")
    public ResponseEntity<Void> clearReaction(@AuthenticationPrincipal String userId, @PathVariable String jobId) {
        feedback.clearReaction(uid(userId), jobId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/feedback")
    public ResponseEntity<Map<String, Long>> events(@AuthenticationPrincipal String userId,
                                                    @RequestBody FeedbackBatch batch) {
        long n = feedback.recordEvents(uid(userId), batch.events());
        return ResponseEntity.accepted().body(Map.of("recorded", n));
    }

    @GetMapping("/interactions")
    public Interactions interactions(@AuthenticationPrincipal String userId) {
        return feedback.interactions(uid(userId));
    }
}
```

- [ ] **Step 2: 보안 확인** — `SecurityConfig` 에 `/api/v1/me/**` 가 이미 `.authenticated()` 인지 확인(member-profile 에서 추가됨). 있으면 무변경. 없으면 추가.
- [ ] **Step 3: 빌드 + 전체 테스트** — `cd backend && ./gradlew build --no-daemon` → BUILD SUCCESSFUL.
- [ ] **Step 4: Commit**
```bash
git add backend/src/main/java/com/devjobs/feedback/FeedbackController.java
git commit -m "feat(be): /api/v1/me feedback endpoints (saved/reactions/feedback/interactions)"
```

---

### Task 6: MeRecommendController — dislike 제외

**Files:** Modify `backend/src/main/java/com/devjobs/profile/MeRecommendController.java`

- [ ] **Step 1: FeedbackService 주입 + post-filter** — 생성자에 `FeedbackService` 추가, 추천 결과에서 dislike job_id 제외.

생성자/필드에 추가:
```java
    private final com.devjobs.feedback.FeedbackService feedbackService;
```
(생성자 파라미터에 `com.devjobs.feedback.FeedbackService feedbackService` 추가 + `this.feedbackService = feedbackService;`)

`recommend(...)` 의 마지막 부분을 교체:
```java
        RecommendRequest rr = ProfileService.toRecommendRequest(profileOpt.get(), note);
        RecommendResponse rec = recommendService.recommend(rr);
        java.util.Set<String> disliked = feedbackService.dislikedJobIds(id);
        if (!disliked.isEmpty()) {
            var kept = rec.recommendations().stream()
                .filter(item -> !disliked.contains(item.job().id()))
                .toList();
            rec = new RecommendResponse(rec.total_candidates(), kept.size(), kept);
        }
        return ResponseEntity.ok(rec);
```
(주의: `RecommendResponse` 의 실제 컴포넌트명(`total_candidates`/`returned`/`recommendations`)과 `JobDto.id()` 접근자명에 맞춘다 — RecommendDtos.java 확인. 다르면 그에 맞게.)

- [ ] **Step 2: 빌드** — `cd backend && ./gradlew build --no-daemon` → SUCCESSFUL(기존 테스트 포함 PASS).
- [ ] **Step 3: Commit**
```bash
git add backend/src/main/java/com/devjobs/profile/MeRecommendController.java
git commit -m "feat(be): exclude disliked jobs from /recommend/me results"
```

---

### Task 7: 웹 인증 프록시 라우트 5종

**Files:** Create `web/app/api/me/saved/route.ts`, `web/app/api/me/saved/[jobId]/route.ts`, `web/app/api/me/reactions/[jobId]/route.ts`, `web/app/api/me/feedback/route.ts`, `web/app/api/me/interactions/route.ts`

모두 `getSessionToken` + Bearer 포워딩 + 401/502 패턴(기존 `app/api/me/recommend/route.ts` 와 동일 구조).

- [ ] **Step 1: interactions (GET)** — `web/app/api/me/interactions/route.ts`:
```ts
import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/interactions`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "불러올 수 없어요." }, { status: 502 });
  }
}
```

- [ ] **Step 2: feedback (POST)** — `web/app/api/me/feedback/route.ts`:
```ts
import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/feedback`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: await req.text(),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "기록 실패" }, { status: 502 });
  }
}
```

- [ ] **Step 3: saved list (GET)** — `web/app/api/me/saved/route.ts`:
```ts
import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/saved`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => []);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "불러올 수 없어요." }, { status: 502 });
  }
}
```

- [ ] **Step 4: saved toggle (PUT/DELETE)** — `web/app/api/me/saved/[jobId]/route.ts`:
```ts
import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

async function forward(method: "PUT" | "DELETE", jobId: string) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/saved/${encodeURIComponent(jobId)}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return NextResponse.json({ ok: res.ok }, { status: res.status });
  } catch {
    return NextResponse.json({ error: "실패" }, { status: 502 });
  }
}

export async function PUT(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  return forward("PUT", jobId);
}
export async function DELETE(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  return forward("DELETE", jobId);
}
```
(주의: Next 14 의 dynamic route `params` 가 Promise 인지 객체인지 프로젝트 버전에 맞춘다 — 기존 `app/jobs/[id]` 라우트를 확인해 동일 시그니처 사용.)

- [ ] **Step 5: reactions (PUT/DELETE)** — `web/app/api/me/reactions/[jobId]/route.ts`:
```ts
import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function PUT(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { jobId } = await ctx.params;
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/reactions/${encodeURIComponent(jobId)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: await req.text(),
      cache: "no-store",
    });
    return NextResponse.json({ ok: res.ok }, { status: res.status });
  } catch {
    return NextResponse.json({ error: "실패" }, { status: 502 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { jobId } = await ctx.params;
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/reactions/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return NextResponse.json({ ok: res.ok }, { status: res.status });
  } catch {
    return NextResponse.json({ error: "실패" }, { status: 502 });
  }
}
```

- [ ] **Step 6: typecheck/lint** — `cd web && npm run typecheck && npm run lint` → 통과.
- [ ] **Step 7: Commit**
```bash
git add web/app/api/me/saved web/app/api/me/reactions web/app/api/me/feedback web/app/api/me/interactions
git commit -m "feat(web): auth proxies for saved/reactions/feedback/interactions"
```

---

### Task 8: feedback 클라이언트 유틸 (+Vitest)

**Files:** Create `web/lib/feedback.ts`, `web/lib/feedback.test.ts`

- [ ] **Step 1: 실패하는 테스트** — `web/lib/feedback.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { recordEvents, recordEvent } from "@/lib/feedback";

afterEach(() => vi.restoreAllMocks());

describe("recordEvents", () => {
  it("POSTs a batch to /api/me/feedback and never throws on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await recordEvents([{ job_id: "j1", action: "impression", rank: 1, score: 0.9 }]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/me/feedback");
    expect(JSON.parse(opts.body).events[0].action).toBe("impression");
  });

  it("swallows fetch errors (fire-and-forget)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    await expect(recordEvents([{ job_id: "j1", action: "click" }])).resolves.toBeUndefined();
  });

  it("no-ops on empty list", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await recordEvents([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("recordEvent", () => {
  it("wraps a single event into a batch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await recordEvent("j2", "apply_click");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).events).toEqual([
      { job_id: "j2", action: "apply_click", rank: undefined, score: undefined },
    ]);
  });
});
```

- [ ] **Step 2: 실패 확인** — `cd web && npm run test -- lib/feedback.test.ts` → FAIL.

- [ ] **Step 3: 구현** — `web/lib/feedback.ts`:
```ts
export type FeedbackAction = "impression" | "click" | "apply_click";

export interface FeedbackEvent {
  job_id: string;
  action: FeedbackAction;
  rank?: number;
  score?: number;
}

/** 이벤트 배치를 기록한다. fire-and-forget — 실패해도 throw 하지 않는다(UX 무영향). */
export async function recordEvents(events: FeedbackEvent[]): Promise<void> {
  if (!events || events.length === 0) return;
  try {
    await fetch("/api/me/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events }),
      keepalive: true,
    });
  } catch {
    // 무시 — 피드백 실패는 사용자 흐름을 막지 않는다.
  }
}

export async function recordEvent(
  jobId: string,
  action: FeedbackAction,
  ctx?: { rank?: number; score?: number },
): Promise<void> {
  await recordEvents([{ job_id: jobId, action, rank: ctx?.rank, score: ctx?.score }]);
}
```

- [ ] **Step 4: 통과 확인** — `cd web && npm run test -- lib/feedback.test.ts` → PASS. typecheck 통과.
- [ ] **Step 5: Commit**
```bash
git add web/lib/feedback.ts web/lib/feedback.test.ts
git commit -m "feat(web): feedback client util (batched, fire-and-forget) + tests"
```

---

### Task 9: InteractiveJobCard (저장/엄지/클릭/노출) (+Vitest)

**Files:** Create `web/components/recommend/InteractiveJobCard.tsx`, `web/components/recommend/InteractiveJobCard.test.tsx`

기존 `RecommendationCard`(읽기전용 카드)를 감싸 인터랙션 바(하트/엄지)를 추가하고, 카드 클릭·지원 클릭·노출 피드백을 발생시킨다.

- [ ] **Step 1: 실패하는 테스트** — `web/components/recommend/InteractiveJobCard.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InteractiveJobCard } from "@/components/recommend/InteractiveJobCard";
import type { RecommendationItem } from "@/lib/types";

const item = {
  job: { id: "greenhouse:acme:1", title: "Backend Engineer", company: { slug: "acme", display_name: "Acme" }, location: "Berlin", is_remote: false, tags: [] },
  score: { final_score: 0.8, stack: 0.5, visa: 1, location: 0.2, seniority: 0.5, salary: 0.6, semantic: 0.3, penalty_applied: 0, reasons: [], deal_breakers: [] },
} as unknown as RecommendationItem;

describe("InteractiveJobCard", () => {
  it("toggles save optimistically and calls onSaveChange", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const onSaveChange = vi.fn();
    render(<InteractiveJobCard item={item} rank={1} initialSaved={false} initialReaction={null} onSaveChange={onSaveChange} onDislike={() => {}} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /저장/ }));
    expect(onSaveChange).toHaveBeenCalledWith("greenhouse:acme:1", true);
  });

  it("calls onDislike when dislike pressed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const onDislike = vi.fn();
    render(<InteractiveJobCard item={item} rank={1} initialSaved={false} initialReaction={null} onSaveChange={() => {}} onDislike={onDislike} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /관심 없음/ }));
    expect(onDislike).toHaveBeenCalledWith("greenhouse:acme:1");
  });
});
```

- [ ] **Step 2: 실패 확인** — `cd web && npm run test -- components/recommend/InteractiveJobCard.test.tsx` → FAIL.

- [ ] **Step 3: 구현** — `web/components/recommend/InteractiveJobCard.tsx`:
```tsx
"use client";

import { useState } from "react";

import { RecommendationCard } from "@/components/recommend/RecommendationCard";
import { recordEvent } from "@/lib/feedback";
import type { RecommendationItem } from "@/lib/types";

export type Reaction = "like" | "dislike" | null;

export function InteractiveJobCard({
  item,
  rank,
  initialSaved,
  initialReaction,
  onSaveChange,
  onDislike,
}: {
  item: RecommendationItem;
  rank: number;
  initialSaved: boolean;
  initialReaction: Reaction;
  onSaveChange: (jobId: string, saved: boolean) => void;
  onDislike: (jobId: string) => void;
}) {
  const jobId = item.job.id;
  const [saved, setSaved] = useState(initialSaved);
  const [reaction, setReaction] = useState<Reaction>(initialReaction);

  async function toggleSave() {
    const next = !saved;
    setSaved(next); // 낙관적
    onSaveChange(jobId, next);
    try {
      const res = await fetch(`/api/me/saved/${encodeURIComponent(jobId)}`, { method: next ? "PUT" : "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setSaved(!next); // revert
      onSaveChange(jobId, !next);
    }
  }

  async function like() {
    const next: Reaction = reaction === "like" ? null : "like";
    setReaction(next);
    try {
      if (next) {
        await fetch(`/api/me/reactions/${encodeURIComponent(jobId)}`, {
          method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ reaction: "like" }),
        });
      } else {
        await fetch(`/api/me/reactions/${encodeURIComponent(jobId)}`, { method: "DELETE" });
      }
    } catch { /* 무시 */ }
  }

  async function dislike() {
    setReaction("dislike");
    try {
      await fetch(`/api/me/reactions/${encodeURIComponent(jobId)}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ reaction: "dislike" }),
      });
    } catch { /* 무시 */ }
    onDislike(jobId); // 목록에서 제거(부모)
  }

  return (
    <div className="flex flex-col">
      <div
        onClickCapture={() => recordEvent(jobId, "click", { rank, score: item.score.final_score })}
      >
        <RecommendationCard item={item} rank={rank} />
      </div>
      <div className="mt-1 flex items-center gap-2 text-caption">
        <button type="button" onClick={toggleSave} aria-pressed={saved}
          className={saved ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
          {saved ? "저장됨" : "저장"}
        </button>
        <button type="button" onClick={like} aria-pressed={reaction === "like"}
          className={reaction === "like" ? "text-primary" : "text-muted-foreground hover:text-foreground"}>
          좋아요
        </button>
        <button type="button" onClick={dislike}
          className="text-muted-foreground hover:text-destructive">
          관심 없음
        </button>
      </div>
    </div>
  );
}
```
(주의: `RecommendationCard` 의 props 는 `{ item, rank }`(기존). 지원 링크 클릭의 `apply_click` 은 카드 내부 지원 버튼이 상세페이지에 있으므로 이번 범위에선 카드 클릭(click)·노출(impression) 위주로 수집하고, apply_click 은 상세페이지 지원 버튼에 `recordEvent(jobId,"apply_click")` 를 다는 것으로 후속 처리 가능 — MVP 는 click/impression/save/reaction.)

- [ ] **Step 4: 통과 확인** — `cd web && npm run test -- components/recommend/InteractiveJobCard.test.tsx` → PASS.
- [ ] **Step 5: Commit**
```bash
git add web/components/recommend/InteractiveJobCard.tsx web/components/recommend/InteractiveJobCard.test.tsx
git commit -m "feat(web): InteractiveJobCard (save/like/dislike + click feedback)"
```

---

### Task 10: MemberLandingRecommend + 랜딩 섹션

**Files:** Create `web/components/home/MemberLandingRecommend.tsx`; Modify `web/app/page.tsx`

- [ ] **Step 1: MemberLandingRecommend 작성** — `web/components/home/MemberLandingRecommend.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { InteractiveJobCard, type Reaction } from "@/components/recommend/InteractiveJobCard";
import { recordEvents } from "@/lib/feedback";
import type { RecommendResponse } from "@/lib/types";

const TOP_N = 6;

export function MemberLandingRecommend() {
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const [recRes, interRes] = await Promise.all([
          fetch("/api/me/recommend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note: null }) }),
          fetch("/api/me/interactions"),
        ]);
        if (recRes.status === 409) { setNeedsProfile(true); return; }
        if (!recRes.ok) return;
        const rec: RecommendResponse = await recRes.json();
        setResult(rec);
        if (interRes.ok) {
          const it = await interRes.json();
          setSaved(new Set<string>(it.saved ?? []));
          setReactions(it.reactions ?? {});
        }
        const top = rec.recommendations.slice(0, TOP_N);
        recordEvents(top.map((item, i) => ({ job_id: item.job.id, action: "impression" as const, rank: i + 1, score: item.score.final_score })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-body-sm text-muted-foreground">맞춤 공고를 불러오는 중…</p>;
  if (needsProfile) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <p className="text-body-sm text-muted-foreground">프로필을 작성하면 맞춤 공고를 받을 수 있어요.</p>
        <Link href="/me/profile" className="mt-3 inline-block rounded-md bg-primary px-5 py-2.5 text-body-sm font-medium text-primary-foreground">
          프로필 작성하기
        </Link>
      </div>
    );
  }
  if (!result || result.recommendations.length === 0) return null;

  const visible = result.recommendations.slice(0, TOP_N).filter((it) => !hidden.has(it.job.id));
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h3">회원님 맞춤 공고</h2>
        <Link href="/recommend" className="text-body-sm text-primary">더 보기 →</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item, i) => (
          <InteractiveJobCard
            key={item.job.id}
            item={item}
            rank={i + 1}
            initialSaved={saved.has(item.job.id)}
            initialReaction={reactions[item.job.id] ?? null}
            onSaveChange={(jobId, s) => setSaved((prev) => { const n = new Set(prev); if (s) n.add(jobId); else n.delete(jobId); return n; })}
            onDislike={(jobId) => setHidden((prev) => new Set(prev).add(jobId))}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 랜딩에 섹션 삽입** — `web/app/page.tsx`: 상단에 `import { MemberLandingRecommend } from "@/components/home/MemberLandingRecommend";` 추가하고, `<Hero .../>` 아래(기존 섹션들 위)에 로그인 회원에게만 렌더:
```tsx
      {session && (
        <div className="mx-auto max-w-6xl px-4">
          <MemberLandingRecommend />
        </div>
      )}
```
(주의: `session` 은 page.tsx 가 이미 `getSession()` 으로 갖고 있다(member-profile). 실제 컨테이너/패딩 클래스는 기존 페이지 레이아웃에 맞춘다 — 다른 섹션과 동일 래퍼 사용.)

- [ ] **Step 3: typecheck/lint/build** — `cd web && npm run typecheck && npm run lint && npm run build` → 통과.
- [ ] **Step 4: Commit**
```bash
git add web/components/home/MemberLandingRecommend.tsx web/app/page.tsx
git commit -m "feat(web): member-personalized recommendations section on landing"
```

---

### Task 11: /me/saved 페이지 + 계정메뉴 링크

**Files:** Create `web/app/me/saved/page.tsx`, `web/components/saved/SavedJobsList.tsx`; Modify `web/components/auth/AccountMenu.tsx`

- [ ] **Step 1: SavedJobsList (client)** — `web/components/saved/SavedJobsList.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { JobCard } from "@/components/job/JobCard";
import type { Job } from "@/lib/types";

export function SavedJobsList() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    fetch("/api/me/saved")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Job[]) => setJobs(d))
      .catch(() => setJobs([]));
  }, []);

  if (jobs === null) return <p className="text-body-sm text-muted-foreground">불러오는 중…</p>;
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-body-sm text-muted-foreground">아직 저장한 공고가 없어요.</p>
        <Link href="/recommend" className="mt-3 inline-block text-body-sm text-primary">맞춤 추천 보러 가기 →</Link>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => <JobCard key={job.id} job={job} />)}
    </div>
  );
}
```
(주의: `JobCard` 의 실제 import 경로/props 는 기존 공고 카드 컴포넌트에 맞춘다 — `/search` 결과가 쓰는 카드를 재사용. 백엔드 `GET /me/saved` 는 JobDto 목록을 반환하므로 `Job` 타입과 정합되어야 함.)

- [ ] **Step 2: /me/saved 페이지(server)** — `web/app/me/saved/page.tsx`:
```tsx
import { SavedJobsList } from "@/components/saved/SavedJobsList";

export const dynamic = "force-dynamic";

export default function SavedPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section>
        <h1 className="text-display">저장한 공고</h1>
        <p className="mt-2 text-muted-foreground">관심 있게 본 공고를 모아둔 곳이에요.</p>
      </section>
      <SavedJobsList />
    </div>
  );
}
```
(`/me/*` 는 미들웨어가 인증 보호.)

- [ ] **Step 3: 계정메뉴 링크** — `web/components/auth/AccountMenu.tsx` 의 "내 지원"(`/me/applications`) 링크 아래에 동일 className 으로 추가:
```tsx
          <Link href="/me/saved" role="menuitem" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-body-sm hover:bg-muted">
            저장한 공고
          </Link>
```
(className/onClick 는 기존 메뉴 항목과 동일하게 — 파일 읽어 맞춤.)

- [ ] **Step 4: typecheck/lint/build** → 통과.
- [ ] **Step 5: Commit**
```bash
git add web/app/me/saved web/components/saved web/components/auth/AccountMenu.tsx
git commit -m "feat(web): /me/saved page + account menu link"
```

---

### Task 12: 라이브 통합 검증 + 최종 게이트

**Files:** 없음(검증).

- [ ] **Step 1: 스택 기동** — worktree 백엔드(V12 적용 위해 재기동)·웹을 대체 포트로([[worktree-devsh-compose-conflict]] 패턴: backend 8090 / web 3100 / 공유 postgres 5433). 검증 계정(프로필 보유, 이메일 인증)으로 로그인.
- [ ] **Step 2: 비회원** — 랜딩에 "회원님 맞춤 공고" 섹션 없음.
- [ ] **Step 3: 무프로필 회원** — 섹션 자리에 "프로필 작성하기" CTA.
- [ ] **Step 4: 프로필 회원** — 랜딩 상단 맞춤 섹션 + 카드. 저장 토글 → DB `saved_jobs` 행 생성/삭제 확인. `/me/saved` 에 반영.
- [ ] **Step 5: dislike** — "관심 없음" → 카드 즉시 제거 + `job_reactions` 기록. 재진입 시 `/recommend/me` 결과에서 제외 확인.
- [ ] **Step 6: 피드백 기록** — 진입 시 `recommendation_feedback` 에 impression 행, 카드 클릭 시 click 행 DB 확인.
- [ ] **Step 7: 최종 빌드 게이트** — `cd web && npm run typecheck && npm run lint && npm run test && npm run build` 모두 통과 + `cd backend && ./gradlew build --no-daemon` BUILD SUCCESSFUL.

---

## Self-Review 결과

**Spec coverage:**
- V12 3테이블 → Task 1 ✅
- 엔티티/repo → Task 2 ✅
- FeedbackService(save/react/events/interactions/disliked) → Task 3 ✅
- 저장 목록 DTO 조회 → Task 4(JobService.byIds) ✅
- 엔드포인트(saved/reactions/feedback/interactions) → Task 5 ✅
- dislike 추천 제외 → Task 6 ✅
- 웹 프록시 5종 → Task 7 ✅
- feedback 유틸 → Task 8 ✅
- InteractiveJobCard(저장/엄지/클릭/노출) → Task 9 ✅
- 랜딩 회원 섹션(3상태) → Task 10 ✅
- /me/saved + 계정메뉴 → Task 11 ✅
- 검증(백엔드/웹/라이브) → Task 3·8·9 단위 + Task 12 라이브 ✅

**Placeholder scan:** 코드 스텝에 실제 코드 포함. "주의" 노트는 기존 멤버명(JobService.toDto/repository/isActive, RecommendDtos 컴포넌트명, JobCard props, AccountMenu className, Next params 시그니처)을 **실제 파일에서 확인해 맞추라**는 지시 — 추측 코드 방지 목적(member-profile 플랜과 동일 방식).

**Type consistency:**
- `FeedbackEvent(job_id, action, rank, score)` — 백엔드 DTO(Task3)·웹 유틸(Task8)·카드(Task9) snake_case 일치 ✅
- `Interactions(saved:List<String>, reactions:Map)` — 백엔드(Task3·5)·웹(Task10) 일치 ✅
- `dislikedJobIds`·`savedJobIds` 시그니처 — Task3 정의, Task5·6 사용 일치 ✅
- `InteractiveJobCard` props(item,rank,initialSaved,initialReaction,onSaveChange,onDislike) — Task9 정의, Task10 사용 일치 ✅
- `JobService.byIds(List<String>)→List<JobDto>` — Task4 정의, Task5 사용 일치 ✅
- 프록시 경로(`/api/me/{saved,reactions,feedback,interactions}`) — Task7 정의, Task8·9·10·11 호출 일치 ✅
