# dev-jobs 사이트 설계 문서

> 한국 개발자가 해외(특히 EU)로 진출할 때 쓰는 채용 공고 사이트. dev-jobs-mcp 코어를 백엔드 라이브러리로 재사용하면서, 일반 사용자용 웹 인터페이스를 추가하는 프로젝트.

작성일: 2026-05-19  
대상 독자: 본인(미래) / 코딩 시작 시점의 본인 / 합류할 동료

---

## 1. 핵심 가치 (왜 만드나)

- **다국어 비자 분류 + evidence**: 영어/독일어/네덜란드어/일본어 4종 패턴. 다른 사이트는 "Visa Sponsorship" 토글 한 줄만 줌. 우리는 매칭된 원문 단편(evidence)을 같이 보여주고 negation 처리까지.
- **점수 분해형 추천**: 6차원(stack/visa/location/seniority/salary/semantic) 분해 + 추천 이유 자연어 + deal-breaker 표시.
- **EU 진출 한정 포지셔닝**: registry 의 회사 태그가 EU 우선, 임베딩 모델이 multilingual.

## 2. 시스템 아키텍처

```
                ┌─────────────────────┐
                │   브라우저 (사용자)   │
                └──────────┬──────────┘
                           │ HTTPS
                ┌──────────▼──────────┐
                │   Next.js 14 (Vercel) │
                │  - App Router + RSC   │
                │  - NextAuth (OAuth)   │
                │  - Tailwind + shadcn  │
                └──────────┬──────────┘
                           │ REST + Bearer JWT
                ┌──────────▼──────────────────────┐
                │   Spring Boot (Railway, Java)    │
                │  - 사용자 API                     │
                │  - 추천 점수 계산 + 정렬           │
                │  - OAuth JWT 검증                 │
                │  - tracker / feedback             │
                └────┬──────────────────┬─────────┘
                     │ JDBC             │ HTTP/JSON
                ┌────▼─────────┐   ┌────▼──────────────────┐
                │  Postgres    │   │  FastAPI (Railway)     │
                │  + pgvector  │   │  - POST /embed         │
                │  (Neon)      │   │  - APScheduler cron    │
                │              │◀──│    (ETL worker)        │
                └──────▲───────┘   └─┬──────────────────────┘
                       │             │
                       │             ▼
                       │  RemoteOK / Arbeitnow / Greenhouse /
                       └─ Lever / Ashby / HN Algolia
```

## 3. 누적 결정사항

| 영역 | 결정 | 이유 |
|---|---|---|
| 타겟 | 한국 개발자, EU 진출 희망 | 좁은 포지셔닝이 차별화. 한글 이력서 → 영어 공고 매칭 |
| 인증 | 게스트 기본 + OAuth 옵트인 (Google/GitHub) | 검색은 가벼움, 저장은 회원만 |
| 추천 | v1 부터 포함 | 핵심 차별화 |
| 백엔드 언어 | Java (Spring Boot) | 사용자 선호 |
| AI 분리 | FastAPI 마이크로서비스 (얇은 책임) | sentence-transformers 는 Python only. Spring 은 임베딩 못 함 |
| AI 책임 범위 | 임베딩 inference + ETL 만 | 점수 계산은 Spring (단순 산수, user context 가 Spring 에 있음) |
| Cosine similarity | Postgres pgvector | SQL 1줄. 별도 벡터 DB 불필요 |
| DB | Postgres + pgvector (Neon) | 서버리스, free tier, pgvector 0.5+ |
| API | REST `/api/v1/...` | JSON:API spec 은 과함 |
| 인증 토큰 | Session cookie (JWT, NextAuth 발급 → Spring 검증) | NEXTAUTH_SECRET 공유만 필요 |
| 페이지네이션 | offset + limit | 검색이 random access 라 OK |
| 에러 응답 | RFC 7807 Problem Details | 표준 |
| Rate limit | per-IP 60req/min (게스트), 600 (로그인) | Bucket4j Spring filter |
| Frontend | Next.js 14 App Router | RSC, SEO 강함, channel 작음 |
| 스타일링 | Tailwind + shadcn/ui | 빠른 prototyping, RSC compatible |
| 검색 state | URL 쿼리스트링 | 공유 가능, 뒤로가기 작동, SEO |
| i18n | 한국어 UI + 영어 콘텐츠 | 한국 사용자가 EU 회사 영어 공고 본다 |
| 폰트 | Pretendard (한글) + Inter (영어/숫자) | 한글 가독성 |
| 차트 | recharts | RSC 친화, 가벼움 |
| 폼 | react-hook-form + zod | Spring 응답 스키마와 같은 zod 로 validation 통일 |
| ETL 주기 | 매시간 (APScheduler in-process) | rate limit 안전 + 신선도 충분 |
| 임베딩 배치 | 32개씩 | 메모리 효율, GPU 없이 5초 내 |
| Upsert | ON CONFLICT UPDATE | last_seen_at 갱신 |
| 사라진 공고 | soft delete (`is_active=false`, 7일 미관측) | 즉시 삭제 X |
| 회사 ETL 우선순위 | EU 회사 우선 | 타겟이 EU 진출 |
| Frontend 배포 | Vercel (icn1) | 한국 사용자 latency 최소 |
| Backend 배포 | Railway (us-east-1) | Docker 자동, env GUI |
| Postgres | Neon Pro (us-east-1) | 서버리스, $19/mo |
| 모니터링 | Sentry Free + BetterUptime Free | MVP 충분 |
| 로깅 | platform 자체 → 나중에 Grafana Cloud | MVP 단순 |
| GDPR | cookie banner + privacy policy 최소 | EU 사용자 대상 |

## 4. 데이터 모델 (Postgres)

```sql
-- 공고 (외부 소스 통합)
CREATE TABLE jobs (
  id              TEXT PRIMARY KEY,            -- "remoteok:123" 등 source:native_id
  source          TEXT NOT NULL,
  title           TEXT NOT NULL,
  company_slug    TEXT NOT NULL REFERENCES companies(slug),
  location        TEXT,
  is_remote       BOOL,
  employment_type TEXT,
  description     TEXT,                        -- HTML 그대로
  description_text TEXT,                       -- plain text (검색용)
  apply_url       TEXT,
  posted_at       TIMESTAMPTZ,
  tags            TEXT[],
  salary_min_usd  INT,
  salary_max_usd  INT,
  visa_status     TEXT,                        -- sponsors / no_sponsor / unclear
  visa_evidence   JSONB,
  embedding       VECTOR(384),                 -- pgvector, multilingual-MiniLM-L12-v2
  first_seen_at   TIMESTAMPTZ DEFAULT now(),
  last_seen_at    TIMESTAMPTZ DEFAULT now(),
  is_active       BOOL DEFAULT TRUE
);
CREATE INDEX ON jobs USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON jobs (visa_status, location, posted_at DESC);
CREATE INDEX ON jobs USING GIN (tags);

-- 회사
CREATE TABLE companies (
  slug         TEXT PRIMARY KEY,        -- 'stripe'
  display_name TEXT NOT NULL,
  ats          TEXT,                    -- greenhouse/lever/ashby
  ats_token    TEXT,
  tags         TEXT[],
  website_url  TEXT,
  blog_rss_url TEXT,
  hn_intel     JSONB,
  last_intel_refresh TIMESTAMPTZ
);

-- 사용자
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oauth_provider TEXT NOT NULL,
  oauth_sub      TEXT NOT NULL,
  email          TEXT,
  display_name   TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (oauth_provider, oauth_sub)
);

-- 지원 추적
CREATE TABLE applications (
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  job_id         TEXT REFERENCES jobs(id),
  status         TEXT NOT NULL,         -- interested/applied/phone_screen/.../rejected/accepted
  notes          TEXT,
  updated_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE TABLE application_events (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID,
  job_id     TEXT,
  event_type TEXT,
  payload    JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 추천 피드백
CREATE TABLE recommendation_feedback (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID,
  job_id      TEXT,
  rating      TEXT CHECK (rating IN ('positive','negative')),
  breakdown   JSONB,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

마이그레이션 도구: **Flyway** (Spring 통합 잘 됨, Python ETL 은 read/write 만 하고 마이그레이션은 안 함).

## 5. API 계약

### 5.1 Spring REST API (사용자 직접 호출)

```
# 공개 (게스트 OK)
GET    /api/v1/jobs                       검색·필터 (q, visa, location, remote, tags, salary, page)
GET    /api/v1/jobs/{id}                  공고 상세 + 비자 evidence
POST   /api/v1/recommend                  추천 (프로필 body)
GET    /api/v1/companies                  회사 디렉터리 (태그 필터)
GET    /api/v1/companies/{slug}           회사 상세 + HN intel
GET    /api/v1/companies/{slug}/jobs      특정 회사 공고

# 로그인 필요 (Bearer JWT)
GET    /api/v1/me
POST   /api/v1/applications
PATCH  /api/v1/applications/{job_id}
GET    /api/v1/applications
GET    /api/v1/applications/pipeline      funnel 통계
GET    /api/v1/applications/{job_id}/history
POST   /api/v1/feedback
GET    /api/v1/feedback/summary
POST   /api/v1/jobs/{id}/interview-prep        # v1.1
POST   /api/v1/jobs/{id}/resume-optimize       # v1.1
POST   /api/v1/applications/{job_id}/recovery  # v1.1
```

페이지네이션: `?page=1&page_size=20` (max 100)  
에러: RFC 7807 `{"type":"...","title":"...","status":400,"detail":"...","instance":"..."}`

### 5.2 FastAPI 내부 API (Spring 만 호출, basic auth)

```
POST   /internal/embed               text → vector(384)
GET    /internal/health
POST   /internal/etl/trigger         수동 fetch (dev 용)
```

SLA: `/embed` p95 < 300ms (모델 warm-up 후).

### 5.3 인증 흐름

```
1. 사용자 → /signin → Google/GitHub OAuth
2. NextAuth → JWT 발급 (HS256, NEXTAUTH_SECRET 서명, exp 1h)
3. JWT → HttpOnly secure cookie
4. fetch('/api/v1/...') 호출 시 Next.js Route Handler 가 Bearer 헤더 추가
5. Spring JwtAuthFilter → 서명 검증 → SecurityContext 주입
6. Controller @AuthenticationPrincipal 로 user_id 획득
```

NextAuth ↔ Spring 은 **JWT 서명 시크릿만 공유**. 다른 storage 공유 X.

## 6. 프론트엔드 구조

### 라우트 (App Router)

```
app/
├── layout.tsx                헤더/푸터, SessionProvider
├── page.tsx                  홈 = 검색 (SSR + 30s cache)
├── jobs/[id]/page.tsx        공고 상세 (SSR + ISR 60s)
├── companies/page.tsx        회사 디렉터리 (SSG + ISR 1h)
├── companies/[slug]/page.tsx (SSR + ISR 1h)
├── recommend/page.tsx        프로필 폼 (CSR)
├── recommend/results/page.tsx (CSR)
├── me/applications/page.tsx  (CSR, auth)
├── me/pipeline/page.tsx      (CSR, auth)
├── me/profile/page.tsx       (CSR, auth)
├── signin/page.tsx           (SSG)
├── about/page.tsx            (SSG)
└── api/auth/[...nextauth]/route.ts
middleware.ts                 /me/* 인증 가드
```

### 핵심 컴포넌트

`JobCard`, `JobDetail`, `VisaBadge`, `SalaryRange`, `SearchBar`, `SearchFilters`, `FacetCount`, `Pagination`, `ProfileForm`, `RecommendationCard`, `ScoreBreakdownBars`, `CompanyCard`, `CompanyHero`, `HNMentionsList`, `ApplicationStatusSelect`, `PipelineFunnel`, `ApplicationHistory`

### 상태 관리

- 검색 필터: URL 쿼리스트링
- 사용자 세션: `useSession()`
- 추천 프로필 폼: React Hook Form
- 이력서 임시: localStorage (게스트), 로그인 시 서버 동기화
- 글로벌: 거의 없음, 필요 시 Zustand

## 7. ETL 파이프라인

```
APScheduler in-process (FastAPI 컨테이너 안에서 별도 스레드)

매시간 cycle:
  1. RemoteOK 전체 fetch (100건)
  2. Arbeitnow 페이지네이션 (3p × 100)
  3. EU 회사 ATS 병렬 fetch (registry tags=eu 인 회사)
  4. dedupe (job_id)
  5. 비자 분류 (다국어 4종 regex)
  6. salary USD 정규화 (sanity check 포함)
  7. 임베딩 계산 (배치 32, multilingual-MiniLM-L12-v2)
  8. Postgres ON CONFLICT UPSERT
  9. last_seen_at + 7일 미관측 → is_active=false

매일:
  - HN intel 갱신 (인기 회사만)
  - RSS feed 체크 (v1.1)

실패 처리:
  - 외부 API 실패 시 지수 백오프 (10s/30s/2m), 3회 후 다음 cycle
  - 소스별 격리 (한 소스 실패가 다른 소스 영향 X)
```

마이그레이션 (기존 dev-jobs-mcp 코드 재사용):
- `sources/*` → ETL worker 안에서 그대로 import
- `analyzers/visa.py`, `analyzers/salary.py`, `analyzers/stack.py` → 그대로
- `recommender/embeddings.py` → /embed endpoint + ETL 임베딩 계산
- `recommender/scorer.py` → **Java 로 포팅** (Week 6)
- `registry/companies.json` → Postgres `companies` 테이블로 마이그레이션

## 8. 배포 토폴로지

| 서비스 | Platform | Region | 비용 |
|---|---|---|---|
| Next.js | Vercel Hobby | icn1 (Seoul) | $0 |
| Spring Boot | Railway | us-east-1 | $5-10/mo |
| FastAPI + Worker | Railway | us-east-1 | $20-30/mo (메모리 큼) |
| Postgres + pgvector | Neon Pro | us-east-1 | $19/mo |
| 도메인 | Cloudflare Registrar | - | $1/mo amortized |
| 에러 추적 | Sentry Free | - | $0 |
| 업타임 | BetterUptime Free | - | $0 |

**MVP 월 비용 (Phase 2 기준): ~$55/mo**

비용 폭발 지점:
- 임베딩 메모리 (470MB 모델 + python overhead) → Railway 2GB+ 필요
- Postgres 스토리지 (jobs + embedding) → 공고 10K개당 ~200MB
- Vercel bandwidth → SSR 트래픽 많으면 Pro $20/mo

비용 절감 옵션:
- 단일 VPS (Hetzner CX22 €4.5/mo) docker-compose → $5/mo, 단 ops 본인 책임

## 9. MVP 로드맵 (8주 풀타임, 사이드는 2-2.5배)

Walking Skeleton 접근: Week 1 에 전 스택 한 줄을 끝까지 연결, 이후 각 층 두껍게.

| Week | 단계 | 핵심 산출물 |
|---|---|---|
| 1 | Foundation | 모든 서비스 `/health` 응답, Vercel/Railway/Neon 배포, GitHub Actions CI |
| 2 | ETL v1 | RemoteOK + Arbeitnow ETL, 비자 분류, jobs 테이블 200+ |
| 3 | 검색 | `GET /jobs` + 필터/페이지네이션 + Next.js 홈 |
| 4 | 상세 | `/jobs/[id]`, `/companies/[slug]`, VisaBadge evidence, HN intel |
| 5 | ETL 확장 + 임베딩 | Greenhouse/Lever/Ashby 추가, embedding 컬럼 채움, FastAPI `/embed` |
| 6 | 추천 | `POST /recommend`, Java scorer 포팅, ProfileForm + ScoreBreakdownBars |
| 7 | 인증 + tracker | NextAuth + JWT, applications, PipelineFunnel |
| 8 | 폴리시 + 런칭 | 도메인, Sentry, privacy/about, 베타 5-10명 |

각 Week 종료 시 Vercel 에 배포 가능한 상태 유지.

## 10. v1.1 이후 (의도적으로 cut)

- RSS 구독 + 신규 글 알림 (기존 `rss_monitor.py` 재사용)
- 인터뷰 준비 키트 (기존 `interview_prep.py` Java 포팅)
- 이력서 최적화 (기존 `resume_optimizer.py`)
- 거절 회복 도우미 (기존 `rejection_recovery.py`)
- Application Kit (기존 `application_kit.py`)
- 피드백 학습 가중치 (데이터 ≥ 5건 후 의미)
- 매칭 공유 (job link, social meta)
- 다국어 UI (현재 한국어 only)

## 11. 위험 요소 + 완화

| 위험 | 확률 | 영향 | 완화 |
|---|---|---|---|
| 외부 API ToS 위반 | 중 | 사이트 다운 | Week 1 에 미리 검토. RemoteOK commercial-use 별도 라이센스 |
| 임베딩 메모리 부족 | 중 | $$ 증가 | Railway 2GB plan 전제. ONNX quantized 대안 |
| pgvector 학습 곡선 | 낮 | 1-2일 지연 | Week 5 전 dummy data PoC |
| Java scorer 결과 불일치 | 중 | 1-2일 디버깅 | Python ↔ Java 비교 테스트 |
| EU 회사 ATS 추출 어려움 | 중 | EU 공고 부족 | registry 30개로 시작, 점진 확장 |
| 한국↔US-east latency | 낮 | UX 불편 | Vercel ISR 캐싱으로 마스킹. 안되면 Railway EU region |
| GDPR 법적 리스크 | 낮 | 차단 | privacy policy + 데이터 삭제 요청 처리 + EU 사용자 명시 동의 |

## 12. 코드 재사용 매핑 (dev-jobs-mcp → 사이트)

| 기존 모듈 | 운명 |
|---|---|
| `sources/*` (5개) | Python ETL 그대로 재사용 |
| `analyzers/visa.py` (다국어) | ETL 에서 그대로 |
| `analyzers/salary.py` | ETL 에서 그대로 |
| `analyzers/stack.py` | ETL 에서 그대로 |
| `recommender/embeddings.py` | FastAPI `/embed` + ETL 임베딩 |
| `recommender/scorer.py` | **Java 로 포팅** |
| `recommender/engine.py` | Java 로 포팅 |
| `registry/companies.json` | Postgres `companies` 로 마이그레이션 |
| `intel.py` | ETL 에서 주기적 갱신 |
| `tracker.py` / `feedback.py` | Java/Spring 으로 재구현 (Postgres) |
| `interview_prep.py` | Java 포팅 (v1.1) |
| `resume_optimizer.py` | Java 포팅 (v1.1) |
| `rejection_recovery.py` | Java 포팅 (v1.1) |
| `rss_monitor.py` | Java + ROME library (v1.1) |
| `application_kit.py` | Java (v1.2) |
| MCP 서버 자체 | Claude 개인용으로 별도 유지 |

## 13. MCP 코어의 Discipline Agents 그룹 (omo 영감)

dev-jobs-mcp 의 26개 tool 을 채용 워크플로우 5단계로 그룹화. Spring 백엔드에서 도메인 패키지 분리 시 그대로 참고.

```
Scout (5)        → Analyst (4)      → Strategist (4)    → Tracker (10)         → Recovery (2)
탐색·필터          분석·평가           추천·계획             지원·기록·모니터링       거절 후 회복
                                                                                    └─→ Scout 로 회귀 (사이클)
```

| Discipline | 역할 | 주요 tool |
|---|---|---|
| **Scout** | 새 공고·회사 발견, 필터링 | search_dev_jobs / list_company_jobs / find_visa_sponsors / find_companies / check_new_jobs |
| **Analyst** | 깊이 평가, 사용자 매핑 | get_job_details / get_company_intel / match_resume_to_job / get_salary_insights |
| **Strategist** | 우선순위·지원 준비 | recommend_jobs / prepare_application_kit / generate_interview_prep / **ultrawork** |
| **Tracker** | 지원·모니터링·피드백 | track_application / list_applications / get_pipeline_summary / get_application_history / subscribe_company_blog 외 5개 |
| **Recovery** | 거절 후 다음 행동 | find_recovery_path / optimize_resume_for_job |

메타 tool:
- `ultrawork` — Strategist 안의 "한 호출로 모두" 메타 (omo `ultrawork` 패턴)
- `list_disciplines` — 5개 그룹 전체/상세 조회

Spring 포팅 시 패키지 구조 매핑 가이드:
```
backend/src/main/java/.../
├── scout/         (검색·필터 Controller, Service)
├── analyst/       (분석·인텔 Service)
├── strategist/    (추천 Engine, 점수화)
├── tracker/       (지원 추적, 피드백)
└── recovery/      (회복·이력서 최적화)
```

## 14. 다음 액션

- [ ] DESIGN.md 검토 + 누락된 결정 추가
- [ ] 외부 API ToS 검토 (RemoteOK, Greenhouse 등)
- [ ] GitHub 레포 만들기 (frontend, backend, ai 3개 또는 monorepo 1개)
- [ ] 도메인 후보 검색 + 등록
- [ ] Week 1 Foundation 시작
