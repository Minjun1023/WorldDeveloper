# 자연어 맞춤 추천 구현 계획 (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 랜딩의 "나에게 맞는 공고" 섹션에서 자연어 한 문장을 입력하면 프로필로 파싱해 기존 6차원 추천 엔진으로 맞춤 공고를 보여준다.

**Architecture:** web(Vercel) → Next 프록시 → Spring(`/api/v1/recommend/nl`) → ai(`/internal/parse-profile`). 파싱은 **규칙 우선 + LLM(gpt-4o-mini) 폴백**. 레이트리밋·파싱 캐시는 Spring(상태 유지)에서 처리(Redis 미사용). 추천 자체는 기존 `RecommendService`(pgvector + 스코어러) 재사용.

**Tech Stack:** FastAPI(ai), Spring Boot(JUnit), Flyway, Next.js. 검증: ai=pytest, 백엔드 로직=JUnit, 통합/프론트=build+curl+브라우저.

**관련 설계:** `docs/superpowers/specs/2026-05-24-main-landing-page-design.md`(§5), API 계약 `docs/api/main-landing-recommend-api.md`. **선행:** Plan 1(랜딩) 완료 — 이 plan은 `RecommendCta`를 `NlRecommend`로 교체한다.

---

## 파일 구조

```
ai/
├── app/profile_parser.py              (신규) 규칙 파서 (순수 함수)
├── app/routes/parse_profile.py        (신규) /internal/parse-profile + LLM 폴백
├── app/main.py                        (수정) 라우터 등록
├── pyproject.toml                     (수정) pytest pythonpath
└── tests/                             (신규) test_profile_parser.py, test_parse_profile_route.py

backend/src/main/java/com/devjobs/strategist/
├── RateLimiter.java                   (신규) 인메모리 토큰버킷
├── NlCacheKey.java                    (신규) 정규화 + sha-256
├── NlProfileCacheEntity.java          (신규) JPA 엔티티
├── NlProfileCacheRepository.java      (신규) repo
├── AiClient.java                      (수정) parseProfile 메서드
├── NlRecommendController.java         (신규) POST /api/v1/recommend/nl
└── NlRecommendService.java            (신규) 오케스트레이션
backend/src/main/resources/db/migration/V5__nl_profile_cache.sql   (신규)
backend/src/test/java/com/devjobs/strategist/
├── RateLimiterTest.java               (신규)
└── NlCacheKeyTest.java                (신규)

web/
├── app/api/recommend-nl/route.ts      (신규) 프록시
├── components/home/NlRecommend.tsx    (신규) 클라이언트 추천 섹션
└── app/page.tsx                       (수정) RecommendCta → NlRecommend
```

---

## Task 1: ai 규칙 파서 (pytest TDD)

자연어 → 구조화 프로필 추출(순수 함수). LLM 없이 대부분 처리.

**Files:**
- Create: `ai/app/profile_parser.py`
- Test: `ai/tests/test_profile_parser.py`
- Modify: `ai/pyproject.toml` (pytest pythonpath)

- [ ] **Step 1: pytest pythonpath 설정**

`ai/pyproject.toml` 끝에 추가:

```toml
[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

- [ ] **Step 2: 실패하는 테스트 작성**

`ai/tests/test_profile_parser.py`:

```python
from app.profile_parser import parse_rules


def test_full_korean_sentence():
    p = parse_rules("3년차 백엔드, Go·Python, 베를린 선호, 비자 스폰서 필요")
    assert "Go" in p.skills and "Python" in p.skills
    assert p.years_experience == 3
    assert p.seniority == "mid"
    assert p.preferred_locations == ["Berlin"]
    assert p.needs_visa_sponsorship is True
    assert p.sufficient is True


def test_remote_and_salary_english():
    p = parse_rules("junior frontend, React, remote, €60k")
    assert "React" in p.skills
    assert p.seniority == "junior"
    assert p.remote_preference == "remote"
    assert p.desired_salary_usd == int(60000 * 1.08)
    assert p.sufficient is True


def test_garbage_input_is_insufficient():
    p = parse_rules("안녕하세요")
    assert p.skills == []
    assert p.preferred_locations == []
    assert p.seniority is None
    assert p.sufficient is False
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd ai && uv sync --extra dev && uv run pytest tests/test_profile_parser.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.profile_parser'`

- [ ] **Step 4: 파서 구현**

`ai/app/profile_parser.py`:

```python
"""자연어 → 구조화 프로필 (규칙 기반, 순수 함수). LLM 폴백은 라우트에서."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

KNOWN_SKILLS = {
    "go": "Go", "golang": "Go", "python": "Python", "java": "Java",
    "kotlin": "Kotlin", "javascript": "JavaScript", "typescript": "TypeScript",
    "ts": "TypeScript", "react": "React", "vue": "Vue", "angular": "Angular",
    "node": "Node.js", "nodejs": "Node.js", "spring": "Spring", "django": "Django",
    "fastapi": "FastAPI", "rust": "Rust", "scala": "Scala", "ruby": "Ruby",
    "php": "PHP", "aws": "AWS", "gcp": "GCP", "kubernetes": "Kubernetes",
    "k8s": "Kubernetes", "docker": "Docker", "postgresql": "PostgreSQL",
    "postgres": "PostgreSQL", "kafka": "Kafka", "spark": "Spark",
}

KNOWN_LOCATIONS = {
    "베를린": "Berlin", "berlin": "Berlin", "뮌헨": "Munich", "munich": "Munich",
    "암스테르담": "Amsterdam", "amsterdam": "Amsterdam", "런던": "London", "london": "London",
    "더블린": "Dublin", "dublin": "Dublin", "독일": "Germany", "germany": "Germany",
    "네덜란드": "Netherlands", "netherlands": "Netherlands",
    "영국": "United Kingdom", "uk": "United Kingdom",
    "아일랜드": "Ireland", "ireland": "Ireland",
}


@dataclass
class ParsedProfile:
    skills: list[str] = field(default_factory=list)
    seniority: str | None = None
    years_experience: int | None = None
    needs_visa_sponsorship: bool | None = None
    preferred_locations: list[str] = field(default_factory=list)
    remote_preference: str | None = None
    desired_salary_usd: int | None = None
    sufficient: bool = False


def _seniority_from_years(y: int) -> str:
    if y < 2:
        return "junior"
    if y <= 5:
        return "mid"
    return "senior"


def parse_rules(text: str) -> ParsedProfile:
    low = text.lower()
    p = ParsedProfile()

    for tok in re.split(r"[\s,/·、]+", low):
        tok = tok.strip(".")
        canon = KNOWN_SKILLS.get(tok)
        if canon and canon not in p.skills:
            p.skills.append(canon)

    m = re.search(r"(\d+)\s*(년차|년|years?|yrs?)", low)
    if m:
        p.years_experience = int(m.group(1))
        p.seniority = _seniority_from_years(p.years_experience)
    if p.seniority is None:
        if any(k in low for k in ("신입", "주니어", "junior")):
            p.seniority = "junior"
        elif any(k in low for k in ("시니어", "senior", "리드", "lead")):
            p.seniority = "senior"

    for key, canon in KNOWN_LOCATIONS.items():
        if key in low and canon not in p.preferred_locations:
            p.preferred_locations.append(canon)

    if any(k in low for k in ("비자", "sponsor", "visa")):
        p.needs_visa_sponsorship = True

    if any(k in low for k in ("원격", "재택", "remote")):
        p.remote_preference = "remote"

    sal = re.search(r"[€$]?\s*(\d{2,3})\s*k", low)
    if sal:
        amount = int(sal.group(1)) * 1000
        if "€" in text:
            amount = int(amount * 1.08)
        p.desired_salary_usd = amount

    p.sufficient = bool(p.skills or p.preferred_locations or p.seniority)
    return p
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd ai && uv run pytest tests/test_profile_parser.py -v`
Expected: 3 passed

- [ ] **Step 6: 커밋**

```bash
git add ai/app/profile_parser.py ai/tests/test_profile_parser.py ai/pyproject.toml
git commit -m "feat(ai): 자연어 프로필 규칙 파서 + pytest"
```

---

## Task 2: ai parse-profile 라우트 + LLM 폴백 (pytest TDD)

규칙 우선, 부족 시 gpt-4o-mini 폴백. translate.py 와 동일한 httpx/json_object 패턴.

**Files:**
- Create: `ai/app/routes/parse_profile.py`
- Modify: `ai/app/main.py`
- Test: `ai/tests/test_parse_profile_route.py`

- [ ] **Step 1: 실패하는 라우트 테스트 작성** (규칙 경로 — 키 없이 동작)

`ai/tests/test_parse_profile_route.py`:

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_rules_path_no_llm():
    r = client.post("/internal/parse-profile", json={"text": "3년차 백엔드 Go Python 베를린 비자"})
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "rules"
    assert body["sufficient"] is True
    assert "Go" in body["profile"]["skills"]


def test_too_long_is_400():
    r = client.post("/internal/parse-profile", json={"text": "x" * 201})
    assert r.status_code == 422  # pydantic max_length
```

- [ ] **Step 2: 실패 확인**

Run: `cd ai && uv run pytest tests/test_parse_profile_route.py -v`
Expected: FAIL — 404 (라우트 없음)

- [ ] **Step 3: 라우트 구현**

`ai/app/routes/parse_profile.py`:

```python
"""POST /internal/parse-profile — 자연어 → RecommendProfile.

규칙 우선(profile_parser), 부족할 때만 gpt-4o-mini 폴백(JSON 모드, max_tokens 200).
"""
from __future__ import annotations

import json
import logging
import os

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..config import settings
from ..profile_parser import ParsedProfile, parse_rules

log = logging.getLogger(__name__)
router = APIRouter()

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4o-mini"

SYSTEM = (
    "Extract a developer job-search profile from a short Korean/English sentence. "
    'Respond with ONLY JSON with keys: skills (string[]), '
    'seniority ("junior"|"mid"|"senior"|null), years_experience (int|null), '
    "needs_visa_sponsorship (bool|null), preferred_locations (string[], English city/country), "
    'remote_preference ("remote"|null), desired_salary_usd (int|null). Keep tech names in English.'
)


class ParseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=200)
    lang: str = "ko"


class ProfilePayload(BaseModel):
    skills: list[str] = []
    seniority: str | None = None
    years_experience: int | None = None
    needs_visa_sponsorship: bool | None = None
    preferred_locations: list[str] = []
    remote_preference: str | None = None
    desired_salary_usd: int | None = None


class ParseResponse(BaseModel):
    profile: ProfilePayload
    source: str
    sufficient: bool


def _to_payload(p: ParsedProfile) -> ProfilePayload:
    return ProfilePayload(
        skills=p.skills,
        seniority=p.seniority,
        years_experience=p.years_experience,
        needs_visa_sponsorship=p.needs_visa_sponsorship,
        preferred_locations=p.preferred_locations,
        remote_preference=p.remote_preference,
        desired_salary_usd=p.desired_salary_usd,
    )


async def _llm_fallback(text: str) -> ProfilePayload | None:
    key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        return None
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                OPENAI_URL,
                headers={"Authorization": f"Bearer {key}", "content-type": "application/json"},
                json={
                    "model": MODEL,
                    "max_tokens": 200,
                    "temperature": 0.0,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": SYSTEM},
                        {"role": "user", "content": text},
                    ],
                },
            )
        if resp.status_code != 200:
            log.warning("parse llm HTTP %s: %s", resp.status_code, resp.text[:200])
            return None
        obj = json.loads(resp.json()["choices"][0]["message"]["content"] or "{}")
        data = {k: obj[k] for k in ProfilePayload.model_fields if k in obj and obj[k] is not None}
        return ProfilePayload(**data)
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
        log.warning("parse llm 실패: %s", e)
        return None


@router.post("/parse-profile", response_model=ParseResponse)
async def parse_profile(req: ParseRequest) -> ParseResponse:
    rules = parse_rules(req.text)
    if rules.sufficient:
        return ParseResponse(profile=_to_payload(rules), source="rules", sufficient=True)
    llm = await _llm_fallback(req.text)
    if llm is not None:
        suff = bool(llm.skills or llm.preferred_locations or llm.seniority)
        return ParseResponse(profile=llm, source="llm", sufficient=suff)
    return ParseResponse(profile=_to_payload(rules), source="rules", sufficient=False)
```

- [ ] **Step 4: main.py 에 라우터 등록**

`ai/app/main.py` 수정:
- import 줄: `from .routes import embed, etl, health, translate` → `from .routes import embed, etl, health, parse_profile, translate`
- 등록부에 추가: `app.include_router(parse_profile.router, prefix="/internal", tags=["internal"])`

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd ai && uv run pytest tests/test_parse_profile_route.py -v`
Expected: 2 passed

- [ ] **Step 6: 커밋**

```bash
git add ai/app/routes/parse_profile.py ai/app/main.py ai/tests/test_parse_profile_route.py
git commit -m "feat(ai): POST /internal/parse-profile (규칙 + LLM 폴백)"
```

---

## Task 3: Flyway V5 — nl_profile_cache 테이블

**Files:**
- Create: `backend/src/main/resources/db/migration/V5__nl_profile_cache.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 자연어 프로필 파싱 결과 캐시 (text -> profile). 추천 결과는 캐싱하지 않음.
CREATE TABLE IF NOT EXISTS nl_profile_cache (
    input_hash   CHAR(64) PRIMARY KEY,        -- sha-256 hex of normalized text
    profile_json TEXT        NOT NULL,         -- 직렬화된 ParseResult
    source       VARCHAR(16) NOT NULL,         -- "rules" | "llm"
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: 마이그레이션 적용 확인**

Run: `cd backend && ./gradlew flywayInfo` (또는 앱 기동 시 자동 적용). 로컬 DB 필요.
Expected: V5 가 pending → 적용됨. (Flyway 미구성 시 앱 기동 로그에서 V5 적용 확인)

- [ ] **Step 3: 커밋**

```bash
git add backend/src/main/resources/db/migration/V5__nl_profile_cache.sql
git commit -m "feat(db): nl_profile_cache 테이블 (V5)"
```

---

## Task 4: Spring RateLimiter (JUnit TDD)

인메모리 고정창 토큰버킷. 시계 주입으로 시간 진행 테스트.

**Files:**
- Create: `backend/src/main/java/com/devjobs/strategist/RateLimiter.java`
- Test: `backend/src/test/java/com/devjobs/strategist/RateLimiterTest.java`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/devjobs/strategist/RateLimiterTest.java`:

```java
package com.devjobs.strategist;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class RateLimiterTest {

    @Test
    void allowsUpToCapacityThenBlocks() {
        long[] now = {0L};
        RateLimiter rl = new RateLimiter(3, 1000L, () -> now[0]);
        assertTrue(rl.tryAcquire("ip"));
        assertTrue(rl.tryAcquire("ip"));
        assertTrue(rl.tryAcquire("ip"));
        assertFalse(rl.tryAcquire("ip"));
    }

    @Test
    void resetsAfterWindow() {
        long[] now = {0L};
        RateLimiter rl = new RateLimiter(1, 1000L, () -> now[0]);
        assertTrue(rl.tryAcquire("ip"));
        assertFalse(rl.tryAcquire("ip"));
        now[0] = 1000L;
        assertTrue(rl.tryAcquire("ip"));
    }

    @Test
    void keysAreIndependent() {
        long[] now = {0L};
        RateLimiter rl = new RateLimiter(1, 1000L, () -> now[0]);
        assertTrue(rl.tryAcquire("a"));
        assertTrue(rl.tryAcquire("b"));
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.devjobs.strategist.RateLimiterTest"`
Expected: 컴파일 실패 (RateLimiter 없음)

- [ ] **Step 3: 구현**

`backend/src/main/java/com/devjobs/strategist/RateLimiter.java`:

```java
package com.devjobs.strategist;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import org.springframework.stereotype.Component;

/** 인메모리 고정창 레이트리밋 (단일 인스턴스). 키별 독립. */
@Component
public class RateLimiter {

    private final int capacity;
    private final long windowMillis;
    private final LongSupplier clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    private static final class Window {
        long start;
        int count;
    }

    public RateLimiter() {
        this(10, 3_600_000L, System::currentTimeMillis); // 시간당 10회
    }

    RateLimiter(int capacity, long windowMillis, LongSupplier clock) {
        this.capacity = capacity;
        this.windowMillis = windowMillis;
        this.clock = clock;
    }

    public boolean tryAcquire(String key) {
        long now = clock.getAsLong();
        Window w = windows.computeIfAbsent(key, k -> new Window());
        synchronized (w) {
            if (now - w.start >= windowMillis) {
                w.start = now;
                w.count = 0;
            }
            if (w.count >= capacity) {
                return false;
            }
            w.count++;
            return true;
        }
    }
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.devjobs.strategist.RateLimiterTest"`
Expected: 3 tests passed

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/java/com/devjobs/strategist/RateLimiter.java backend/src/test/java/com/devjobs/strategist/RateLimiterTest.java
git commit -m "feat(backend): 인메모리 RateLimiter + 테스트"
```

---

## Task 5: NlCacheKey (JUnit TDD) + 캐시 엔티티/repo

**Files:**
- Create: `backend/src/main/java/com/devjobs/strategist/NlCacheKey.java`
- Create: `backend/src/main/java/com/devjobs/strategist/NlProfileCacheEntity.java`
- Create: `backend/src/main/java/com/devjobs/strategist/NlProfileCacheRepository.java`
- Test: `backend/src/test/java/com/devjobs/strategist/NlCacheKeyTest.java`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/devjobs/strategist/NlCacheKeyTest.java`:

```java
package com.devjobs.strategist;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import org.junit.jupiter.api.Test;

class NlCacheKeyTest {

    @Test
    void normalizeLowercasesAndCollapsesWhitespace() {
        assertEquals("go python", NlCacheKey.normalize("  Go   Python "));
    }

    @Test
    void sameNormalizedInputSameHash() {
        assertEquals(NlCacheKey.hash("Go Python"), NlCacheKey.hash("  go   python "));
    }

    @Test
    void differentInputDifferentHash_andLength64() {
        assertNotEquals(NlCacheKey.hash("Go"), NlCacheKey.hash("Python"));
        assertEquals(64, NlCacheKey.hash("Go").length());
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.devjobs.strategist.NlCacheKeyTest"`
Expected: 컴파일 실패

- [ ] **Step 3: NlCacheKey 구현**

`backend/src/main/java/com/devjobs/strategist/NlCacheKey.java`:

```java
package com.devjobs.strategist;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public final class NlCacheKey {

    private NlCacheKey() {}

    public static String normalize(String text) {
        return text.trim().toLowerCase().replaceAll("\\s+", " ");
    }

    public static String hash(String text) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(normalize(text).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.devjobs.strategist.NlCacheKeyTest"`
Expected: 3 tests passed

- [ ] **Step 5: 엔티티 + repo 작성**

`backend/src/main/java/com/devjobs/strategist/NlProfileCacheEntity.java`:

```java
package com.devjobs.strategist;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "nl_profile_cache")
public class NlProfileCacheEntity {

    @Id
    @Column(name = "input_hash")
    private String inputHash;

    @Column(name = "profile_json", nullable = false)
    private String profileJson;

    @Column(name = "source", nullable = false)
    private String source;

    @Column(name = "created_at")
    private Instant createdAt;

    protected NlProfileCacheEntity() {}

    public NlProfileCacheEntity(String inputHash, String profileJson, String source) {
        this.inputHash = inputHash;
        this.profileJson = profileJson;
        this.source = source;
        this.createdAt = Instant.now();
    }

    public String getProfileJson() { return profileJson; }
    public String getSource() { return source; }
}
```

`backend/src/main/java/com/devjobs/strategist/NlProfileCacheRepository.java`:

```java
package com.devjobs.strategist;

import org.springframework.data.jpa.repository.JpaRepository;

public interface NlProfileCacheRepository extends JpaRepository<NlProfileCacheEntity, String> {}
```

- [ ] **Step 6: 컴파일 확인 + 커밋**

Run: `cd backend && ./gradlew compileJava`
Expected: 성공

```bash
git add backend/src/main/java/com/devjobs/strategist/NlCacheKey.java \
        backend/src/main/java/com/devjobs/strategist/NlProfileCacheEntity.java \
        backend/src/main/java/com/devjobs/strategist/NlProfileCacheRepository.java \
        backend/src/test/java/com/devjobs/strategist/NlCacheKeyTest.java
git commit -m "feat(backend): NlCacheKey(해시) + nl_profile_cache 엔티티/repo"
```

---

## Task 6: AiClient.parseProfile 메서드

ai `/internal/parse-profile` 호출 → `ParseResult` 매핑. embed/translate 와 동일 패턴.

**Files:**
- Modify: `backend/src/main/java/com/devjobs/strategist/AiClient.java`

- [ ] **Step 1: ParseResult 레코드 + parseProfile 추가**

`AiClient.java` 의 import 에 `com.fasterxml.jackson.annotation.JsonProperty` 추가. 클래스 내부에 추가:

```java
    /** /internal/parse-profile 응답. */
    public record ParseResult(Profile profile, String source, boolean sufficient) {
        public record Profile(
            List<String> skills,
            String seniority,
            @JsonProperty("years_experience") Integer yearsExperience,
            @JsonProperty("needs_visa_sponsorship") Boolean needsVisaSponsorship,
            @JsonProperty("preferred_locations") List<String> preferredLocations,
            @JsonProperty("remote_preference") String remotePreference,
            @JsonProperty("desired_salary_usd") Integer desiredSalaryUsd
        ) {}
    }

    /** 자연어 → 파싱 프로필. 실패 시 null. */
    public ParseResult parseProfile(String text) {
        try {
            String json = mapper.writeValueAsString(Map.of("text", text, "lang", "ko"));
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/internal/parse-profile"))
                .header("content-type", "application/json")
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                log.warn("ai parse-profile HTTP {}: {}", resp.statusCode(), resp.body());
                return null;
            }
            return mapper.readValue(resp.body(), ParseResult.class);
        } catch (Exception e) {
            log.warn("ai parse-profile 실패: {}", e.getMessage());
            return null;
        }
    }
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd backend && ./gradlew compileJava`
Expected: 성공

- [ ] **Step 3: 커밋**

```bash
git add backend/src/main/java/com/devjobs/strategist/AiClient.java
git commit -m "feat(backend): AiClient.parseProfile (자연어 파싱 호출)"
```

---

## Task 7: NlRecommendService + Controller (POST /api/v1/recommend/nl)

레이트리밋 → 캐시 → ai 파싱 → 기존 추천 재사용 오케스트레이션.

**Files:**
- Create: `backend/src/main/java/com/devjobs/strategist/NlRecommendService.java`
- Create: `backend/src/main/java/com/devjobs/strategist/NlRecommendController.java`

- [ ] **Step 1: 서비스 작성**

`backend/src/main/java/com/devjobs/strategist/NlRecommendService.java`:

```java
package com.devjobs.strategist;

import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import com.devjobs.strategist.dto.RecommendDtos.RecommendResponse;
import com.devjobs.strategist.dto.RecommendDtos.RecommendationItem;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
public class NlRecommendService {

    private static final int MAX_LEN = 200;

    private final RateLimiter rateLimiter;
    private final NlProfileCacheRepository cacheRepo;
    private final AiClient aiClient;
    private final RecommendService recommendService;
    private final ObjectMapper mapper;

    public NlRecommendService(RateLimiter rateLimiter, NlProfileCacheRepository cacheRepo,
                              AiClient aiClient, RecommendService recommendService,
                              ObjectMapper mapper) {
        this.rateLimiter = rateLimiter;
        this.cacheRepo = cacheRepo;
        this.aiClient = aiClient;
        this.recommendService = recommendService;
        this.mapper = mapper;
    }

    public record NlRequest(String text, Integer topK, Integer maxPerCompany) {}

    public record NlRecommendResponse(
        String parseSource,
        AiClient.ParseResult.Profile parsedProfile,
        int totalCandidates,
        int returned,
        List<RecommendationItem> recommendations
    ) {}

    public ResponseEntity<?> recommend(NlRequest req, String clientKey) {
        String text = req.text();
        if (text == null || text.isBlank() || text.length() > MAX_LEN) {
            return ResponseEntity.badRequest().body(Map.of("error", "text 누락 또는 200자 초과"));
        }
        if (!rateLimiter.tryAcquire(clientKey)) {
            return ResponseEntity.status(429).header("Retry-After", "3600")
                .body(Map.of("error", "요청이 많습니다. 잠시 후 다시 시도하세요."));
        }

        String hash = NlCacheKey.hash(text);
        AiClient.ParseResult parsed = loadCache(hash);
        if (parsed == null) {
            parsed = aiClient.parseProfile(text);
            if (parsed == null) {
                return ResponseEntity.status(503).body(Map.of("error", "프로필 파싱 실패(AI 미연결)"));
            }
            saveCache(hash, parsed);
        }

        RecommendRequest rr = toRecommendRequest(parsed.profile(), req);
        RecommendResponse rec = recommendService.recommend(rr);
        return ResponseEntity.ok(new NlRecommendResponse(
            parsed.source(), parsed.profile(),
            rec.totalCandidates(), rec.returned(), rec.recommendations()));
    }

    private AiClient.ParseResult loadCache(String hash) {
        return cacheRepo.findById(hash).map(e -> {
            try {
                return mapper.readValue(e.getProfileJson(), AiClient.ParseResult.class);
            } catch (Exception ex) {
                return null;
            }
        }).orElse(null);
    }

    private void saveCache(String hash, AiClient.ParseResult parsed) {
        try {
            cacheRepo.save(new NlProfileCacheEntity(hash, mapper.writeValueAsString(parsed), parsed.source()));
        } catch (Exception ignored) {
            // 캐시 저장 실패는 치명적이지 않음
        }
    }

    private RecommendRequest toRecommendRequest(AiClient.ParseResult.Profile p, NlRequest req) {
        return new RecommendRequest(
            p.skills(), p.seniority(), p.yearsExperience(),
            null, null, p.needsVisaSponsorship(), p.preferredLocations(),
            p.remotePreference(), p.desiredSalaryUsd(), null,
            req.topK() != null ? req.topK() : 6,
            req.maxPerCompany() != null ? req.maxPerCompany() : 2);
    }
}
```

- [ ] **Step 2: 컨트롤러 작성**

`backend/src/main/java/com/devjobs/strategist/NlRecommendController.java`:

```java
package com.devjobs.strategist;

import com.devjobs.strategist.NlRecommendService.NlRequest;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/recommend/nl")
public class NlRecommendController {

    private final NlRecommendService service;

    public NlRecommendController(NlRecommendService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<?> recommend(@RequestBody NlRequest req, HttpServletRequest http) {
        return service.recommend(req, clientKey(http));
    }

    private String clientKey(HttpServletRequest http) {
        String fwd = http.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) {
            return fwd.split(",")[0].trim();
        }
        return http.getRemoteAddr();
    }
}
```

> 주의: `RecommendController` 가 `@RequestMapping("/api/v1/recommend")` + `@PostMapping`(빈 경로)이고, 이 컨트롤러는 `/api/v1/recommend/nl`. 스프링은 더 구체적 경로를 우선 매칭하므로 충돌 없음.

- [ ] **Step 3: 빌드 확인**

Run: `cd backend && ./gradlew compileJava`
Expected: 성공

- [ ] **Step 4: 통합 확인 (로컬 서비스 기동 후)**

```bash
# DB+backend+ai 기동 후:
curl -s -X POST localhost:8080/api/v1/recommend/nl \
  -H 'content-type: application/json' \
  -d '{"text":"3년차 백엔드 Go Python 베를린 비자","top_k":3}' | head -c 400
```
Expected: `parse_source`, `parsed_profile`, `recommendations[]` 가 포함된 JSON (200). 11회째 호출은 429.

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/java/com/devjobs/strategist/NlRecommendService.java \
        backend/src/main/java/com/devjobs/strategist/NlRecommendController.java
git commit -m "feat(backend): POST /api/v1/recommend/nl (레이트리밋+캐시+파싱+추천)"
```

---

## Task 8: Next 프록시 /api/recommend-nl

**Files:**
- Create: `web/app/api/recommend-nl/route.ts`

- [ ] **Step 1: 라우트 작성** (translate route 패턴, IP 전달)

```ts
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const body = await req.text();
  const fwd =
    req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/recommend/nl`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": fwd },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 2: 타입체크 + 빌드**

Run: `cd web && npm run typecheck && npm run build`
Expected: 성공

- [ ] **Step 3: 커밋**

```bash
git add web/app/api/recommend-nl/route.ts
git commit -m "feat(web): /api/recommend-nl 프록시"
```

---

## Task 9: NlRecommend 클라이언트 컴포넌트

자연어 입력 → `/api/recommend-nl` → `RecommendationCard` 재사용 렌더. 상태 + localStorage.

**Files:**
- Create: `web/components/home/NlRecommend.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
"use client";

import { useEffect, useState } from "react";

import { RecommendationCard } from "@/components/recommend/RecommendationCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RecommendResponse } from "@/lib/types";

const STORAGE_KEY = "nl-recommend-last";
const EXAMPLE = "3년차 백엔드, Go·Python, 베를린 선호, 비자 스폰서 필요";

export function NlRecommend() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setText(saved);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    localStorage.setItem(STORAGE_KEY, q);
    try {
      const res = await fetch("/api/recommend-nl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: q, top_k: 6 }),
      });
      if (res.status === 429) {
        setError("요청이 많습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      if (!res.ok) {
        setError("추천을 불러오지 못했습니다.");
        return;
      }
      setResult((await res.json()) as RecommendResponse);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLE}
          maxLength={200}
          aria-label="자연어 프로필"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "분석 중..." : "추천 받기"}
        </Button>
      </form>
      <p className="mt-2 text-caption text-muted-foreground">
        한 문장으로 적으면 AI가 프로필로 변환해 6차원 점수로 추천합니다.
      </p>

      {error && <p className="mt-4 text-body-sm text-destructive">{error}</p>}

      {result && result.recommendations.length === 0 && (
        <p className="mt-4 text-body-sm text-muted-foreground">
          조건에 맞는 추천이 없습니다. 문장을 더 구체적으로 적어보세요.
        </p>
      )}

      {result && result.recommendations.length > 0 && (
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {result.recommendations.map((item, i) => (
            <RecommendationCard key={item.job.id} item={item} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
```

> `RecommendResponse`/`RecommendationItem` 는 기존 `lib/types.ts` 그대로. 백엔드의 `parse_source`/`parsed_profile` 추가 필드는 무시(필요 시 후속에서 "이렇게 이해했어요" 표시).

- [ ] **Step 2: 타입체크 + 빌드**

Run: `cd web && npm run typecheck && npm run build`
Expected: 성공

- [ ] **Step 3: 커밋**

```bash
git add web/components/home/NlRecommend.tsx
git commit -m "feat(home): NlRecommend 자연어 맞춤 추천 컴포넌트"
```

---

## Task 10: 랜딩에 NlRecommend 연결 + 브라우저 검증

`RecommendCta` 를 `NlRecommend` 로 교체.

**Files:**
- Modify: `web/app/page.tsx`

- [ ] **Step 1: 랜딩 교체**

`web/app/page.tsx`:
- import 추가: `import { NlRecommend } from "@/components/home/NlRecommend";`
- import 제거: `RecommendCta` 줄
- 추천 섹션 본문 `<RecommendCta />` → `<NlRecommend />`

(`web/components/home/RecommendCta.tsx` 파일은 더 이상 쓰지 않으면 삭제: `git rm web/components/home/RecommendCta.tsx`)

- [ ] **Step 2: 타입체크 + 빌드**

Run: `cd web && npm run typecheck && npm run build`
Expected: 성공

- [ ] **Step 3: 브라우저 통합 검증** (DB+backend+ai+web 기동)

http://localhost:3000 에서:
- "나에게 맞는 공고"에 입력창 표시, 예시 placeholder
- 예시 문장 입력 → "추천 받기" → 점수 카드(6차원 막대) 표시
- 같은 문장 재요청 → 캐시 적중(백엔드 로그에 ai parse 호출 없음)
- 11회 연타 → "요청이 많습니다" 표시(429)
- 백엔드/ai 미연결 → 에러 메시지, 페이지 정상

- [ ] **Step 4: lint + 커밋**

```bash
cd web && npm run lint
git add web/app/page.tsx
git rm web/components/home/RecommendCta.tsx
git commit -m "feat(home): 맞춤추천 섹션을 인라인 NL 추천으로 교체"
```

---

## Self-Review (작성자 체크 결과)

- **스펙/ API 명세 커버리지**: `/internal/parse-profile`(T1,T2) ✓, `/api/v1/recommend/nl`(T7) ✓, `/api/recommend-nl`(T8) ✓, 규칙+LLM 폴백(T1,T2) ✓, 레이트리밋 429(T4,T7) ✓, 파싱 캐시 nl_profile_cache(T3,T5,T7) ✓, 프롬프트 봉인(max_tokens 200, json_object)(T2) ✓, 입력 200자 제한(T2 pydantic, T7 백엔드) ✓, 기존 추천 재사용(T7) ✓, NlRecommend가 RecommendCta 교체(T10) ✓.
- **플레이스홀더**: 모든 단계 실제 코드. TODO 없음.
- **타입 일관성**: ai `ProfilePayload`(snake_case) ↔ Spring `ParseResult.Profile`(@JsonProperty snake_case) ↔ `RecommendRequest`(camelCase, Jackson SNAKE_CASE 직렬화) ↔ 프론트 `RecommendResponse`/`RecommendationItem`(types.ts) 정합. `RecommendationCard` props `{item, rank}` 일치.
- **검증 도구**: ai=pytest(`uv run pytest`), 백엔드 로직=JUnit(`./gradlew test --tests`), 통합=curl, 프론트=typecheck+build+브라우저.
- **DB**: V5 마이그레이션(T3) 이 엔티티(T5)·서비스(T7)보다 먼저. 의존성 순서 OK.
- **주의/리스크**: ai 파싱 캐시는 ParseResult 전체를 JSON 저장(sufficient 포함). RecommendController 와 경로 충돌 없음(더 구체적 경로 우선). 레이트리밋·캐시는 단일 인스턴스 전제(스펙 §5.5).
