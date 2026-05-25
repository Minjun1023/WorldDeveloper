# AI 공고 요약 구현 계획 (스펙 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공고 상세에서 영문 공고를 한국어 4섹션(주요 업무/자격 요건/비자·이주/연봉·복지) 요약으로 온디맨드 제공한다.

**Architecture:** 기존 번역 기능을 미러링 — web → Next 프록시 → Spring(`getOrCreate` 캐시 우선) → ai(gpt-4o-mini). DB 영구 캐시(`job_summaries`). 단일 문서 요약(RAG 아님).

**Tech Stack:** FastAPI(ai, pytest), Spring Boot(JUnit+Mockito), Flyway, Next.js(typecheck/build). 검증: ai=pytest, 서비스=JUnit, 통합/프론트=build+라이브 curl.

**관련 설계:** `docs/superpowers/specs/2026-05-25-job-summary-design.md`. 미러 대상(읽어볼 것): `ai/app/routes/translate.py`, `backend/.../translate/TranslationService.java`, `backend/.../domain/JobTranslationEntity.java`, `web/components/job/JobDescription.tsx`, `web/app/api/translate/route.ts`.

---

## 파일 구조

```
ai/app/routes/summarize.py              (신규) POST /internal/summarize
ai/app/main.py                          (수정) 라우터 등록
ai/tests/test_summarize_route.py        (신규)

backend/src/main/resources/db/migration/V6__job_summaries.sql        (신규)
backend/src/main/java/com/devjobs/domain/JobSummaryEntity.java        (신규) 복합PK
backend/src/main/java/com/devjobs/summarize/JobSummaryRepository.java (신규)
backend/src/main/java/com/devjobs/summarize/dto/SummaryDtos.java      (신규)
backend/src/main/java/com/devjobs/strategist/AiClient.java            (수정) summarize 메서드
backend/src/main/java/com/devjobs/summarize/SummaryService.java       (신규) getOrCreate
backend/src/main/java/com/devjobs/summarize/SummaryController.java    (신규) GET /jobs/{id}/summary
backend/src/test/java/com/devjobs/summarize/SummaryServiceTest.java   (신규) Mockito

web/app/api/job-summary/route.ts        (신규) 프록시
web/lib/types.ts                        (수정) JobSummary 타입
web/components/job/JobSummary.tsx       (신규) 온디맨드 컴포넌트
web/app/jobs/[id]/page.tsx              (수정) JobSummary 렌더
```

---

## Task 1: ai `/internal/summarize` 라우트 (pytest TDD)

**Files:**
- Create: `ai/app/routes/summarize.py`
- Modify: `ai/app/main.py`
- Test: `ai/tests/test_summarize_route.py`

- [ ] **Step 1: 실패 테스트 작성**

`ai/tests/test_summarize_route.py`:

```python
import os

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def test_empty_description_returns_400():
    r = client.post("/internal/summarize", json={"title": "x", "description": "   "})
    assert r.status_code == 400


@pytest.mark.skipif(
    bool(settings.openai_api_key or os.getenv("OPENAI_API_KEY")),
    reason="OPENAI_API_KEY set — 503 경로 스킵",
)
def test_no_key_returns_503():
    r = client.post("/internal/summarize", json={"description": "We need a senior backend engineer."})
    assert r.status_code == 503
```

- [ ] **Step 2: 실패 확인**

Run: `cd ai && uv run pytest tests/test_summarize_route.py -v`
Expected: FAIL — 404 (라우트 없음)

- [ ] **Step 3: 라우트 구현**

`ai/app/routes/summarize.py`:

```python
"""POST /internal/summarize — 영문 공고 → 한국어 4섹션 요약 (gpt-4o-mini, JSON 모드)."""
from __future__ import annotations

import json
import logging
import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import settings

log = logging.getLogger(__name__)
router = APIRouter()

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4o-mini"

SYSTEM = (
    "You summarize a software engineering job posting into Korean for Korean developers. "
    "Keep technical terms, programming languages, frameworks, tool names, and company names in English. "
    "Summarize ONLY what the posting explicitly states — never invent information. "
    "Respond with ONLY a JSON object with exactly these keys, each an array of concise Korean bullet "
    "strings (3-6 items each, or [] if the posting lacks that info): "
    '"responsibilities" (주요 업무), "requirements" (자격 요건), '
    '"visa" (비자/스폰서십/이주 관련), "compensation" (연봉/복지).'
)


class SummarizeRequest(BaseModel):
    title: str = ""
    description: str = Field("", max_length=20_000)
    lang: str = "ko"


class SummarizeResponse(BaseModel):
    responsibilities: list[str] = []
    requirements: list[str] = []
    visa: list[str] = []
    compensation: list[str] = []
    engine: str


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(req: SummarizeRequest) -> SummarizeResponse:
    # 입력 검증 먼저 (키 유무와 무관하게 400)
    if not req.description.strip():
        raise HTTPException(400, "description 비어있음")
    key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(503, "OPENAI_API_KEY not set — 요약 기능 미설정")

    user = json.dumps({"title": req.title, "description": req.description}, ensure_ascii=False)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                OPENAI_URL,
                headers={"Authorization": f"Bearer {key}", "content-type": "application/json"},
                json={
                    "model": MODEL,
                    "max_tokens": 500,
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": SYSTEM},
                        {"role": "user", "content": user},
                    ],
                },
            )
        if resp.status_code != 200:
            log.warning("openai summarize HTTP %s: %s", resp.status_code, resp.text[:300])
            raise HTTPException(502, f"summarize upstream error ({resp.status_code})")
        obj = json.loads(resp.json()["choices"][0]["message"]["content"] or "{}")

        def arr(k: str) -> list[str]:
            v = obj.get(k)
            return [str(x) for x in v] if isinstance(v, list) else []

        return SummarizeResponse(
            responsibilities=arr("responsibilities"),
            requirements=arr("requirements"),
            visa=arr("visa"),
            compensation=arr("compensation"),
            engine=MODEL,
        )
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
        log.warning("openai summarize 실패: %s", e)
        raise HTTPException(502, f"summarize request failed: {e}") from e
```

- [ ] **Step 4: main.py 라우터 등록**

`ai/app/main.py`:
- import: `from .routes import embed, etl, health, parse_profile, summarize, translate`
- 등록 추가: `app.include_router(summarize.router, prefix="/internal", tags=["internal"])`

- [ ] **Step 5: 통과 확인**

Run: `cd ai && uv run pytest tests/test_summarize_route.py -v`
Expected: `test_empty_description_returns_400` PASS; `test_no_key_returns_503` PASS 또는 SKIP(키 설정 시)

- [ ] **Step 6: 커밋**

```bash
git add ai/app/routes/summarize.py ai/app/main.py ai/tests/test_summarize_route.py
git commit -m "feat(ai): POST /internal/summarize (영문→한국어 4섹션)"
```

---

## Task 2: Flyway V6 — job_summaries

**Files:**
- Create: `backend/src/main/resources/db/migration/V6__job_summaries.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 공고 요약 캐시 (온디맨드 + 영구 캐싱). job_translations 와 동일 구조.
CREATE TABLE IF NOT EXISTS job_summaries (
    job_id       TEXT NOT NULL,
    lang         TEXT NOT NULL,
    summary_json TEXT NOT NULL,      -- {responsibilities,requirements,visa,compensation} JSON
    engine       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (job_id, lang),
    CONSTRAINT fk_job_summaries_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
);
```

- [ ] **Step 2: 적용 확인 (로컬 DB 기동 시)**

Run: 앱 기동 시 Flyway 자동 적용. 또는 `docker exec dev-jobs-postgres psql -U devjobs -d devjobs -c "\d job_summaries"`.
Expected: 테이블 생성됨. (DB 없으면 런타임 적용으로 연기)

- [ ] **Step 3: 커밋**

```bash
git add backend/src/main/resources/db/migration/V6__job_summaries.sql
git commit -m "feat(db): job_summaries 테이블 (V6)"
```

---

## Task 3: JobSummaryEntity + Repository

`JobTranslationEntity`(복합 PK) 미러.

**Files:**
- Create: `backend/src/main/java/com/devjobs/domain/JobSummaryEntity.java`
- Create: `backend/src/main/java/com/devjobs/summarize/JobSummaryRepository.java`

- [ ] **Step 1: 엔티티 작성**

`backend/src/main/java/com/devjobs/domain/JobSummaryEntity.java`:

```java
package com.devjobs.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.Objects;

/** 공고 요약 캐시 (job_id, lang) 복합 PK. */
@Entity
@Table(name = "job_summaries")
@IdClass(JobSummaryEntity.Key.class)
public class JobSummaryEntity {

    @Id
    @Column(name = "job_id")
    private String jobId;

    @Id
    private String lang;

    @Column(name = "summary_json")
    private String summaryJson;

    private String engine;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    protected JobSummaryEntity() {}

    public JobSummaryEntity(String jobId, String lang, String summaryJson, String engine) {
        this.jobId = jobId;
        this.lang = lang;
        this.summaryJson = summaryJson;
        this.engine = engine;
        this.createdAt = OffsetDateTime.now();
    }

    public String getJobId() { return jobId; }
    public String getLang() { return lang; }
    public String getSummaryJson() { return summaryJson; }
    public String getEngine() { return engine; }

    /** 복합 PK (job_id, lang) */
    public static class Key implements Serializable {
        private String jobId;
        private String lang;

        public Key() {}

        public Key(String jobId, String lang) {
            this.jobId = jobId;
            this.lang = lang;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Key key)) return false;
            return Objects.equals(jobId, key.jobId) && Objects.equals(lang, key.lang);
        }

        @Override
        public int hashCode() {
            return Objects.hash(jobId, lang);
        }
    }
}
```

- [ ] **Step 2: 리포지토리 작성**

`backend/src/main/java/com/devjobs/summarize/JobSummaryRepository.java`:

```java
package com.devjobs.summarize;

import com.devjobs.domain.JobSummaryEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JobSummaryRepository
    extends JpaRepository<JobSummaryEntity, JobSummaryEntity.Key> {

    Optional<JobSummaryEntity> findByJobIdAndLang(String jobId, String lang);
}
```

- [ ] **Step 3: 컴파일 + 커밋**

Run: `cd backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

```bash
git add backend/src/main/java/com/devjobs/domain/JobSummaryEntity.java backend/src/main/java/com/devjobs/summarize/JobSummaryRepository.java
git commit -m "feat(backend): JobSummaryEntity + repository"
```

---

## Task 4: AiClient.summarize + SummaryDtos

**Files:**
- Modify: `backend/src/main/java/com/devjobs/strategist/AiClient.java`
- Create: `backend/src/main/java/com/devjobs/summarize/dto/SummaryDtos.java`

- [ ] **Step 1: SummaryDtos 작성**

`backend/src/main/java/com/devjobs/summarize/dto/SummaryDtos.java`:

```java
package com.devjobs.summarize.dto;

import java.util.List;

/** 요약 응답 DTO. Jackson SNAKE_CASE 로 jobId → job_id 변환. */
public final class SummaryDtos {

    private SummaryDtos() {}

    public record SummaryDto(
        String jobId,
        String lang,
        List<String> responsibilities,
        List<String> requirements,
        List<String> visa,
        List<String> compensation,
        String engine,
        boolean cached
    ) {}
}
```

- [ ] **Step 2: AiClient.summarize 추가**

`AiClient.java` 클래스 내부에 추가 (embed/translate 와 동일 JDK HttpClient 패턴). `import java.util.List;` 는 이미 존재.

```java
    /** AI /internal/summarize 응답 (4섹션 + 엔진). */
    public record AiSummary(
        List<String> responsibilities,
        List<String> requirements,
        List<String> visa,
        List<String> compensation,
        String engine
    ) {}

    /** 공고를 한국어 4섹션으로 요약. 실패(키 미설정/업스트림 오류 포함) 시 null. */
    public AiSummary summarize(String title, String description) {
        try {
            String json = mapper.writeValueAsString(Map.of(
                "title", title == null ? "" : title,
                "description", description == null ? "" : description,
                "lang", "ko"));
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/internal/summarize"))
                .header("content-type", "application/json")
                .timeout(Duration.ofSeconds(70))
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                log.warn("ai summarize HTTP {}: {}", resp.statusCode(), resp.body());
                return null;
            }
            return mapper.readValue(resp.body(), AiSummary.class);
        } catch (Exception e) {
            log.warn("ai summarize 실패: {}", e.getMessage());
            return null;
        }
    }
```

- [ ] **Step 3: 컴파일 + 커밋**

Run: `cd backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

```bash
git add backend/src/main/java/com/devjobs/strategist/AiClient.java backend/src/main/java/com/devjobs/summarize/dto/SummaryDtos.java
git commit -m "feat(backend): AiClient.summarize + SummaryDto"
```

---

## Task 5: SummaryService (JUnit+Mockito TDD) + SummaryController

`TranslationService` 미러. 캐시 우선 → 미스 시 AI → 저장. summary_json 직렬화/역직렬화.

**Files:**
- Create: `backend/src/main/java/com/devjobs/summarize/SummaryService.java`
- Create: `backend/src/main/java/com/devjobs/summarize/SummaryController.java`
- Test: `backend/src/test/java/com/devjobs/summarize/SummaryServiceTest.java`

- [ ] **Step 1: 실패 테스트 작성 (Mockito)**

`backend/src/test/java/com/devjobs/summarize/SummaryServiceTest.java`:

```java
package com.devjobs.summarize;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.devjobs.domain.JobEntity;
import com.devjobs.domain.JobSummaryEntity;
import com.devjobs.scout.JobRepository;
import com.devjobs.strategist.AiClient;
import com.devjobs.summarize.dto.SummaryDtos.SummaryDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class SummaryServiceTest {

    private JobSummaryRepository repo;
    private JobRepository jobRepo;
    private AiClient ai;
    private SummaryService service;

    @BeforeEach
    void setup() {
        repo = Mockito.mock(JobSummaryRepository.class);
        jobRepo = Mockito.mock(JobRepository.class);
        ai = Mockito.mock(AiClient.class);
        service = new SummaryService(repo, jobRepo, ai, new ObjectMapper());
    }

    @Test
    void cacheHit_returnsCached_noAiCall() {
        String json = "{\"responsibilities\":[\"백엔드 개발\"],\"requirements\":[],\"visa\":[],\"compensation\":[]}";
        when(repo.findByJobIdAndLang("j1", "ko"))
            .thenReturn(Optional.of(new JobSummaryEntity("j1", "ko", json, "gpt-4o-mini")));

        SummaryDto dto = service.getOrCreate("j1", "ko").orElseThrow();

        assertTrue(dto.cached());
        assertEquals(List.of("백엔드 개발"), dto.responsibilities());
        verify(ai, never()).summarize(anyString(), anyString());
    }

    @Test
    void cacheMiss_callsAi_savesAndReturns() {
        when(repo.findByJobIdAndLang("j1", "ko")).thenReturn(Optional.empty());
        JobEntity job = Mockito.mock(JobEntity.class);
        when(job.getIsActive()).thenReturn(true);
        when(job.getTitle()).thenReturn("Backend Engineer");
        when(job.getDescriptionText()).thenReturn("We build payments.");
        when(jobRepo.findById("j1")).thenReturn(Optional.of(job));
        when(ai.summarize(anyString(), anyString())).thenReturn(new AiClient.AiSummary(
            List.of("결제 시스템 개발"), List.of("Go 3년"), List.of(), List.of("€90k"), "gpt-4o-mini"));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SummaryDto dto = service.getOrCreate("j1", "ko").orElseThrow();

        assertFalse(dto.cached());
        assertEquals(List.of("결제 시스템 개발"), dto.responsibilities());
        assertEquals(List.of("€90k"), dto.compensation());
        verify(repo).save(any(JobSummaryEntity.class));
    }

    @Test
    void aiUnavailable_throws() {
        when(repo.findByJobIdAndLang("j1", "ko")).thenReturn(Optional.empty());
        JobEntity job = Mockito.mock(JobEntity.class);
        when(job.getIsActive()).thenReturn(true);
        when(jobRepo.findById("j1")).thenReturn(Optional.of(job));
        when(ai.summarize(any(), any())).thenReturn(null);

        assertThrows(SummaryService.SummaryUnavailableException.class,
            () -> service.getOrCreate("j1", "ko"));
    }

    @Test
    void jobMissing_returnsEmpty() {
        when(repo.findByJobIdAndLang("j1", "ko")).thenReturn(Optional.empty());
        when(jobRepo.findById("j1")).thenReturn(Optional.empty());

        assertTrue(service.getOrCreate("j1", "ko").isEmpty());
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.devjobs.summarize.SummaryServiceTest"`
Expected: 컴파일 실패 (SummaryService 없음)

- [ ] **Step 3: SummaryService 구현**

`backend/src/main/java/com/devjobs/summarize/SummaryService.java`:

```java
package com.devjobs.summarize;

import com.devjobs.domain.JobEntity;
import com.devjobs.domain.JobSummaryEntity;
import com.devjobs.scout.JobRepository;
import com.devjobs.strategist.AiClient;
import com.devjobs.summarize.dto.SummaryDtos.SummaryDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SummaryService {

    /** AI 요약 사용 불가(키 미설정/업스트림 오류). 컨트롤러가 503 으로 매핑. */
    public static class SummaryUnavailableException extends RuntimeException {}

    /** summary_json 직렬화 형태 (4섹션). */
    public record Sections(
        List<String> responsibilities,
        List<String> requirements,
        List<String> visa,
        List<String> compensation
    ) {}

    private final JobSummaryRepository repo;
    private final JobRepository jobRepo;
    private final AiClient ai;
    private final ObjectMapper mapper;

    public SummaryService(JobSummaryRepository repo, JobRepository jobRepo, AiClient ai, ObjectMapper mapper) {
        this.repo = repo;
        this.jobRepo = jobRepo;
        this.ai = ai;
        this.mapper = mapper;
    }

    @Transactional
    public Optional<SummaryDto> getOrCreate(String jobId, String lang) {
        Optional<JobSummaryEntity> cached = repo.findByJobIdAndLang(jobId, lang);
        if (cached.isPresent()) {
            return Optional.of(toDto(cached.get(), true));
        }

        JobEntity job = jobRepo.findById(jobId)
            .filter(j -> Boolean.TRUE.equals(j.getIsActive()))
            .orElse(null);
        if (job == null) {
            return Optional.empty();
        }

        String src = job.getDescriptionText() != null ? job.getDescriptionText() : job.getDescription();
        AiClient.AiSummary s = ai.summarize(job.getTitle(), src);
        if (s == null) {
            throw new SummaryUnavailableException();
        }

        String json = serialize(new Sections(
            s.responsibilities(), s.requirements(), s.visa(), s.compensation()));
        JobSummaryEntity saved = repo.save(new JobSummaryEntity(jobId, lang, json, s.engine()));
        return Optional.of(toDto(saved, false));
    }

    private SummaryDto toDto(JobSummaryEntity e, boolean cached) {
        Sections sec = deserialize(e.getSummaryJson());
        return new SummaryDto(
            e.getJobId(), e.getLang(),
            sec.responsibilities(), sec.requirements(), sec.visa(), sec.compensation(),
            e.getEngine(), cached);
    }

    private String serialize(Sections sec) {
        try {
            return mapper.writeValueAsString(sec);
        } catch (Exception ex) {
            throw new IllegalStateException("summary 직렬화 실패", ex);
        }
    }

    private Sections deserialize(String json) {
        try {
            return mapper.readValue(json, Sections.class);
        } catch (Exception ex) {
            throw new IllegalStateException("summary 역직렬화 실패", ex);
        }
    }
}
```

- [ ] **Step 4: SummaryController 구현**

`backend/src/main/java/com/devjobs/summarize/SummaryController.java`:

```java
package com.devjobs.summarize;

import com.devjobs.summarize.SummaryService.SummaryUnavailableException;
import com.devjobs.summarize.dto.SummaryDtos.SummaryDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 공고 요약 — 인증 불필요. 캐시 우선, 미스 시 AI. id 는 콜론 포함이라 {id:.+}. */
@RestController
@RequestMapping("/api/v1/jobs/{id:.+}")
public class SummaryController {

    private final SummaryService service;

    public SummaryController(SummaryService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    public ResponseEntity<SummaryDto> summary(
        @PathVariable String id, @RequestParam(defaultValue = "ko") String lang) {
        try {
            return service.getOrCreate(id, lang)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
        } catch (SummaryUnavailableException e) {
            return ResponseEntity.status(503).build();
        }
    }
}
```

- [ ] **Step 5: 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.devjobs.summarize.SummaryServiceTest"`
Expected: 4 tests passed

- [ ] **Step 6: 커밋**

```bash
git add backend/src/main/java/com/devjobs/summarize/SummaryService.java backend/src/main/java/com/devjobs/summarize/SummaryController.java backend/src/test/java/com/devjobs/summarize/SummaryServiceTest.java
git commit -m "feat(backend): SummaryService(캐시 getOrCreate) + GET /jobs/{id}/summary"
```

---

## Task 6: Next 프록시 + JobSummary 타입

**Files:**
- Create: `web/app/api/job-summary/route.ts`
- Modify: `web/lib/types.ts`

- [ ] **Step 1: 프록시 작성** (translate 라우트 미러)

`web/app/api/job-summary/route.ts`:

```ts
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const { job_id, lang } = (await req.json()) as { job_id?: string; lang?: string };
  if (!job_id) {
    return NextResponse.json({ error: "job_id required" }, { status: 400 });
  }
  const target = lang ?? "ko";
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/jobs/${job_id}/summary?lang=${target}`,
      { cache: "no-store", signal: AbortSignal.timeout(75_000) },
    );
    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 2: JobSummary 타입 추가**

`web/lib/types.ts` 끝(또는 Translation 인근)에 추가:

```ts
export interface JobSummary {
  job_id: string;
  lang: string;
  responsibilities: string[];
  requirements: string[];
  visa: string[];
  compensation: string[];
  engine: string;
  cached: boolean;
}
```

- [ ] **Step 3: 타입체크 + 커밋**

Run: `cd web && npm run typecheck`
Expected: 에러 없음

```bash
git add web/app/api/job-summary/route.ts web/lib/types.ts
git commit -m "feat(web): /api/job-summary 프록시 + JobSummary 타입"
```

---

## Task 7: JobSummary 컴포넌트 + 공고 상세 연결

`JobDescription` 의 온디맨드 fetch 패턴 미러.

**Files:**
- Create: `web/components/job/JobSummary.tsx`
- Modify: `web/app/jobs/[id]/page.tsx`

- [ ] **Step 1: 컴포넌트 작성**

`web/components/job/JobSummary.tsx`:

```tsx
"use client";

import { useState } from "react";

import type { JobSummary as JobSummaryData } from "@/lib/types";

const SECTIONS: { key: keyof Pick<JobSummaryData, "responsibilities" | "requirements" | "visa" | "compensation">; label: string }[] = [
  { key: "responsibilities", label: "주요 업무" },
  { key: "requirements", label: "자격 요건" },
  { key: "visa", label: "비자·이주" },
  { key: "compensation", label: "연봉·복지" },
];

export function JobSummary({ jobId }: { jobId: string }) {
  const [data, setData] = useState<JobSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/job-summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id: jobId, lang: "ko" }),
      });
      if (res.status === 503) {
        setError("AI 요약을 사용할 수 없습니다 (API 키 미설정).");
        return;
      }
      if (!res.ok) {
        setError(`요약 실패 (HTTP ${res.status}).`);
        return;
      }
      setData((await res.json()) as JobSummaryData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const nonEmpty = data
    ? SECTIONS.filter((s) => (data[s.key] as string[]).length > 0)
    : [];

  return (
    <section className="rounded-lg border border-border bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h3">AI 요약</h2>
        {!data && (
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-md px-2.5 py-1 text-body-sm text-primary hover:underline disabled:text-muted-foreground"
          >
            {loading ? "요약 중…" : "AI 요약 보기"}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-body-sm text-destructive">{error}</p>}

      {data && nonEmpty.length === 0 && (
        <p className="mt-2 text-body-sm text-muted-foreground">요약할 핵심 정보를 찾지 못했습니다.</p>
      )}

      {data && nonEmpty.length > 0 && (
        <div className="mt-3 space-y-4">
          {nonEmpty.map((s) => (
            <div key={s.key}>
              <h3 className="text-body-sm font-semibold">{s.label}</h3>
              <ul className="mt-1 space-y-1 text-body-sm text-muted-foreground">
                {(data[s.key] as string[]).map((item, i) => (
                  <li key={i}>· {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: 공고 상세 페이지에 연결**

`web/app/jobs/[id]/page.tsx`:
- import 추가: `import { JobSummary } from "@/components/job/JobSummary";`
- `{job.description && (<JobDescription .../>)}` 블록 **바로 위**에 추가:

```tsx
      {job.description && <JobSummary jobId={job.id} />}

      {job.description && (
        <JobDescription jobId={job.id} original={job.description} />
      )}
```

- [ ] **Step 3: 타입체크 + 빌드**

Run: `cd web && npm run typecheck && npm run build`
Expected: 성공, `/jobs/[id]` 라우트 빌드됨

- [ ] **Step 4: 커밋**

```bash
git add web/components/job/JobSummary.tsx web/app/jobs/[id]/page.tsx
git commit -m "feat(web): JobSummary 온디맨드 컴포넌트 + 공고 상세 연결"
```

---

## Self-Review (작성자 체크 결과)

- **스펙 커버리지**: ai /internal/summarize(T1) ✓, job_summaries V6(T2) ✓, 엔티티/repo(T3) ✓, AiClient.summarize+DTO(T4) ✓, SummaryService 캐시 getOrCreate + 503 + GET /summary(T5) ✓, Next 프록시(T6) ✓, JobSummary 컴포넌트 4섹션 빈섹션숨김 + 상세 연결(T7) ✓.
- **플레이스홀더**: 모든 단계 실제 코드. TODO 없음.
- **타입 일관성**: ai SummarizeResponse(responsibilities/requirements/visa/compensation/engine) ↔ Spring `AiClient.AiSummary`(동일 키, snake 불필요-단어동일) ↔ `Sections` 직렬화 ↔ `SummaryDto`(Jackson SNAKE_CASE→job_id 등) ↔ 프론트 `JobSummary` 타입(job_id/4배열/engine/cached) 정합. 컴포넌트 `SECTIONS` 키가 타입 키와 일치.
- **검증 도구**: ai=pytest(`uv run pytest`), 서비스=JUnit+Mockito(`./gradlew test --tests SummaryServiceTest`, DB 불필요), 프론트=typecheck/build. Flyway 적용·실제 요약·캐시 동작은 라이브 스택(curl/브라우저)에서.
- **순서 의존성**: V6(T2) → 엔티티(T3) → AiClient/DTO(T4) → Service/Controller(T5) → 프론트(T6,T7). OK.
- **충돌 없음**: SummaryController 와 TranslationController 가 같은 베이스(`/api/v1/jobs/{id:.+}`)에 다른 서브경로(/summary vs /translation) — 정상.
