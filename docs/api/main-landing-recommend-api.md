# API 명세 — 메인 랜딩 + 맞춤 추천 (스펙 1)

작성일: 2026-05-24
관련 설계: `../superpowers/specs/2026-05-24-main-landing-page-design.md`

이 문서는 스펙 1(랜딩 페이지 + 자연어 맞춤 추천)에 관련된 API 계약을 정의한다. **신규** 엔드포인트는 상세히, 랜딩이 소비하는 **기존** 엔드포인트는 참조용으로 기술한다.

## 0. 공통 규약

- **타입 출처**: 스키마 필드는 `web/lib/types.ts` 와 백엔드 DTO 를 따른다. 본 문서는 계약만 정의하고 전체 필드는 타입 파일을 SSOT 로 참조한다.
- **에러 형태**: 실패 응답 본문은 `{ "error": "사람이 읽을 메시지" }` (기존 Next 라우트 컨벤션과 일치).
- **콘텐츠 타입**: 요청/응답 모두 `application/json`.
- **레이어**: 브라우저 → Next 라우트(`/api/*`, 서버 전용 프록시) → Spring(`/api/v1/*`) → ai(`/internal/*`). 브라우저는 `/api/*` 만 본다.
- **호스트(운영)**: web=Vercel, backend/ai=Railway(`ai.railway.internal`), DB=Neon.

---

## 1. (신규) POST /internal/parse-profile  — ai 서비스

자연어 한 문장을 `RecommendProfile` 로 변환. 규칙 우선 추출, 부족할 때만 gpt-4o-mini 폴백.

- **레이어**: ai (FastAPI). 호출자: Spring `AiClient` (embed/translate 와 동일 패턴).
- **인증**: 내부 전용 (Railway 내부 네트워크). embed/translate 와 동일 정책.
- **타임아웃(호출측)**: 30s (LLM 폴백 포함).

### 요청
```json
{ "text": "3년차 백엔드, Go·Python, 베를린 선호, 비자 스폰서 필요", "lang": "ko" }
```
| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `text` | string | ✓ | 1–200자. 초과 시 400 |
| `lang` | string | | 기본 `"ko"` |

### 응답 200
```json
{
  "profile": {
    "skills": ["Go", "Python"],
    "seniority": "mid",
    "years_experience": 3,
    "needs_visa_sponsorship": true,
    "preferred_locations": ["Berlin"],
    "remote_preference": null,
    "desired_salary_usd": null
  },
  "source": "rules",
  "sufficient": true
}
```
- `profile`: `RecommendProfile` (부분 채움 가능). 필드 정의는 `types.ts` 의 `RecommendProfile`.
- `source`: `"rules"` | `"llm"` — 어느 경로로 뽑았는지.
- `sufficient`: boolean — 핵심 필드(스택·지역·시니어리티) 중 하나라도 신뢰도 있게 뽑혔는지. `false` 면 호출측이 가드 메시지 표시.

### 상태 코드
| 코드 | 의미 |
|---|---|
| 200 | 정상 (sparse 여부는 `sufficient` 로 구분) |
| 400 | `text` 누락/빈값/200자 초과 |
| 502 | LLM 폴백 호출 실패 (규칙 결과라도 있으면 200 으로 반환 — 폴백 실패가 곧 502 는 아님) |

### 비용/봉인
- LLM 폴백은 **JSON 모드 + `max_tokens` ≈ 200 + 스키마 검증**. 비준수 출력은 거부하고 규칙 결과로 폴백.
- 규칙으로 충분하면 LLM 미호출(비용 0).

---

## 2. (신규) POST /api/v1/recommend/nl  — Spring 백엔드

자연어를 받아 파싱(1) → 기존 추천 로직 재사용 → 추천 결과 반환. 레이트리밋·파싱 캐시를 여기서 담당.

- **레이어**: Spring. 공개(비인증 허용, 기존 `/api/v1/recommend` 와 동일). 로그인 시 사용자 식별로 별도 한도.
- **기존 `/api/v1/recommend` 와 분리**: ProfileForm(구조화 입력)은 기존 엔드포인트를 그대로 쓴다. 이 엔드포인트는 NL 입력 전용.

### 요청
```json
{ "text": "3년차 백엔드, Go·Python, 베를린 선호, 비자 스폰서 필요", "top_k": 6, "max_per_company": 2 }
```
| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `text` | string | ✓ | 1–200자 |
| `top_k` | int | | 기본 6 (랜딩용). 1–20 |
| `max_per_company` | int | | 기본 2 |

### 처리 순서
1. 레이트리밋 검사 (인메모리 토큰버킷; 익명 IP/세션, 로그인 사용자별). 초과 → 429.
2. `text` 정규화 → `nl_profile_cache(input_hash)` 조회. 적중 시 파싱 생략.
3. 미적중 → `AiClient.parseProfile` (= POST /internal/parse-profile) → `RecommendProfile`, 캐시 저장.
4. 기존 추천 재사용: 프로필 임베딩(`/internal/embed`, 로컬) → `findSemanticCandidates`(pgvector top 50) → 6차원 스코어러 → 다양성 제약 → top_k.

### 응답 200
```json
{
  "parse_source": "rules",
  "parsed_profile": { "skills": ["Go","Python"], "seniority": "mid", "preferred_locations": ["Berlin"], "needs_visa_sponsorship": true },
  "total_candidates": 50,
  "returned": 6,
  "recommendations": [
    { "job": { "...": "Job DTO (types.ts)" },
      "score": { "final_score": 0.92, "stack": 0.95, "visa": 1.0, "location": 0.8, "seniority": 0.9, "salary": 0.6, "semantic": 0.71, "penalty_applied": 0.0, "reasons": ["Go·Python 일치","비자 스폰서 명시"], "deal_breakers": [] } }
  ]
}
```
- `total_candidates`/`returned`/`recommendations` 는 기존 `RecommendResponse` 와 동일.
- `parsed_profile`/`parse_source` 추가 — UI "이렇게 이해했어요" 표시 및 디버깅용.

### 상태 코드 / 헤더
| 코드 | 의미 |
|---|---|
| 200 | 정상 |
| 400 | `text` 누락/빈값/200자 초과 |
| 429 | 레이트리밋 초과. 헤더 `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` |
| 502/503 | ai 파싱/임베딩 업스트림 실패. 가능하면 최신순 후보로 graceful 폴백(`parse_source: "fallback"`), 불가 시 503 |

### 캐싱 주의
- 캐시는 **파싱 결과**(text→profile)만. 추천 결과 자체는 공고가 갱신되므로 캐싱하지 않는다.
- 캐시 테이블: `nl_profile_cache(input_hash PK, profile_json, created_at)`. TTL/정리는 후속(예: created_at 기준 만료).

---

## 3. (신규) POST /api/recommend-nl  — Next.js 라우트 (프록시)

브라우저용 얇은 프록시. `translate` 라우트와 동일 패턴.

- **레이어**: Next (서버 전용). `BACKEND_URL` 로 §2 호출.
- **요청/응답**: §2 와 동일 본문을 그대로 전달/반환(상태코드 패스스루).
- **클라이언트 IP 전달**: 레이트리밋용으로 `X-Forwarded-For` 를 백엔드에 전달.
- **타임아웃**: ~20s.
- **에러**: 업스트림 예외 시 `{ "error": "..." }` + 502.

---

## 4. (기존) GET /api/v1/jobs  — 랜딩 소비 (참조)

비자 스폰서십 공고·신규 공고 섹션이 사용. 변경 없음.

- **쿼리**: `q`, `visa`, `location`, `remote`(bool), `page`(기본 1), `page_size`(기본 20)
- **정렬**: `postedAt DESC` (고정)
- **응답**: `JobListResponse` = `{ items: Job[], page, page_size, total, facets }`, `facets = { visa_status?, is_remote? }` (location facet 없음)
- 랜딩 사용:
  - 비자 섹션 → `?visa=sponsors&page_size=8`
  - 신규 섹션 → `?page_size=6`

## 5. (기존) GET /api/v1/companies  — 랜딩 소비 (참조)

회사 스포트라이트 섹션이 사용. 변경 없음.

- **쿼리**: `tag`(옵션)
- **응답**: `CompanyListResponse` = `{ total, items: CompanySummary[] }`. 랜딩은 앞 N개 사용.

## 6. (기존) POST /api/v1/recommend  — 구조화 추천 (참조)

`/recommend` 페이지의 ProfileForm 이 사용. 본 스펙에서 **변경 없음**. §2 는 이 로직을 내부적으로 재사용한다.

- **요청**: `RecommendProfile` (skills/seniority/needs_visa_sponsorship/preferred_locations/… + top_k/max_per_company)
- **응답**: `RecommendResponse` = `{ total_candidates, returned, recommendations[] }`, 각 항목 `{ job, score: ScoreBreakdown }`
- **비용**: 외부 LLM 호출 없음 (임베딩=로컬 모델, 후보=pgvector, 스코어링=로컬).

---

## 7. 신규 작업 요약 (구현 체크리스트 입력용)

| 레이어 | 신규/변경 | 항목 |
|---|---|---|
| ai | 신규 | `POST /internal/parse-profile` (규칙 + LLM 폴백) |
| Spring | 신규 | `POST /api/v1/recommend/nl`, `AiClient.parseProfile`, 레이트리밋, 파싱 캐시 |
| DB | 신규 | `nl_profile_cache` 마이그레이션 |
| Next | 신규 | `POST /api/recommend-nl` 프록시 |
| Spring | 변경 없음 | `/api/v1/jobs`, `/api/v1/companies`, `/api/v1/recommend` |
