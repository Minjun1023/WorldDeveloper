# 메인 랜딩 페이지 + 맞춤 추천 — 설계 (스펙 1)

작성일: 2026-05-24
상태: 검토 대기

## 1. 개요 / 목표

현재 `/`(메인)는 검색 결과 페이지로 쓰이고 있다. 이를 사람인/잡코리아/직행 같은 **큐레이션형 랜딩 페이지**로 전환한다. 핵심 가치(한국 개발자의 EU 진출 + 비자 스폰서십)를 전면에 두고, 자연어 한 문장으로 받는 **맞춤 추천**을 메인에 제공한다.

벤치마크: 직행(모던/깔끔한 개발자 채용)에 가장 가깝게, 기존 디자인 시스템(`web/DESIGN.md`, Linear/Vercel 풍 미니멀)을 유지한다.

## 2. 범위

**포함 (스펙 1)**
- `/` 를 랜딩 페이지로 전환, 기존 검색 UI 를 `/search` 로 이동
- 랜딩 섹션: Hero → 맞춤 추천(자연어) → 비자 스폰서십 공고 → 국가별 바로가기 → 신규 공고 → 회사 스포트라이트
- 맞춤 추천: 자연어 입력 → 하이브리드 파싱(규칙 우선 + LLM 폴백) → 기존 6차원 추천 엔진
- 비용/어뷰즈 통제 (레이트 리밋, 캐싱, 프롬프트 봉인, 예산 캡)

**제외 (별도 스펙으로 후속)**
- AI 공고 요약 → 스펙 2
- AI 커리어 어시스턴트(챗봇) → 스펙 3
- 가입 시 프로필 캡처·저장(프로필 기반 추천) → 후속 증분 (아래 5.7 참고)
- 자연어 검색(Hero 검색바 AI 변환) → 채택 안 함

## 3. 라우팅 변경

| 경로 | 변경 전 | 변경 후 |
|---|---|---|
| `/` | 검색 결과 (`app/page.tsx`) | **랜딩 페이지** |
| `/search` | 없음 | **검색 결과** (기존 `app/page.tsx` 내용 이동) |

- 헤더 네비 "검색" 링크 → `/search`
- Hero 검색바, 빠른칩, "전체 보기" 링크 → `/search?...` 쿼리로 이동
- `app/page.tsx` 의 현재 로직(searchParams 파싱 + `fetchJobs` + JobCard 그리드 + Pagination)은 **그대로 `app/search/page.tsx` 로 옮긴다** (동작 변경 없음, URL 만 변경)

## 4. 페이지 구조 (위 → 아래)

모두 서버 컴포넌트에서 렌더, 섹션 데이터는 `Promise.all` 로 병렬 fetch. 각 섹션은 독립적으로 실패해도 페이지 전체는 정상 렌더된다.

| # | 섹션 | 데이터 소스 | 빈/에러 상태 |
|---|---|---|---|
| 1 | **Hero** | 정적 | 항상 표시 |
| 2 | **맞춤 추천** (자연어) | 클라이언트 상호작용 (5장) | 미입력 시 입력창+예시 |
| 3 | **비자 스폰서십 공고** | `fetchJobs({visa:"sponsors", pageSize:8})` (postedAt DESC) | 0건/실패 시 섹션 숨김 |
| 4 | **국가별 바로가기** | 정적 타일 → `/search?location=...` | 항상 표시 (공고 수 뱃지는 v1 생략) |
| 5 | **신규 공고** | `fetchJobs({pageSize:6})` (postedAt DESC) | 0건/실패 시 숨김 |
| 6 | **회사 스포트라이트** | `fetchCompanies()` 앞 N개 | null/0개 시 숨김 |

국가 타일 v1 목록: 독일(Berlin/Munich), 네덜란드(Amsterdam), 영국(London), 아일랜드(Dublin). `location` 쿼리로 `/search` 이동.

## 5. 맞춤 추천 기능 상세

### 5.1 입력 (v1: 자연어 우선)

자연어 한 문장 입력창 + 예시 placeholder. 예: `"3년차 백엔드, Go·Python, 베를린 선호, 비자 스폰서 필요"`.
- 마지막 입력은 `localStorage` 에 기억 (인증 의존 없음)
- "정교한 추천 설정" 링크로 기존 `/recommend`(ProfileForm) 연결

### 5.2 하이브리드 파싱 (자연어 → RecommendProfile)

ai 서비스(FastAPI)에 파싱 엔드포인트 `POST /internal/parse-profile` 추가. 번역(`/internal/translate`)과 같은 위치/패턴.

1. **규칙 우선 추출** (LLM 호출 없음, 대부분 여기서 종료):
   - 스택: 알려진 기술 사전 매칭 (Go, Python, React, Kotlin, Java …) → `skills[]`
   - 연차: `"N년차"`, `"N years"` → `years_experience`, 시니어리티 추론 → `seniority`
   - 지역: 도시/국가 사전 (Berlin, Amsterdam, London …) → `preferred_locations[]`
   - 비자: `"비자"`, `"sponsor"` 키워드 → `needs_visa_sponsorship`
   - 원격: `"원격"`, `"remote"` → `remote_preference`
   - 연봉: `"€Xk"`, `"연봉 …"` → `desired_salary_usd`(환산)
2. **LLM 폴백** (규칙이 핵심 필드 — 스택·지역·시니어리티 — 중 하나도 신뢰도 있게 못 뽑은 경우에만): gpt-4o-mini, JSON 모드, `RecommendProfile` 스키마로만 출력

출력은 항상 `RecommendProfile`(skills/seniority/years_experience/needs_visa_sponsorship/preferred_locations/remote_preference/desired_salary_usd …) 으로 정규화.

### 5.3 데이터 흐름

호출 경로는 기존 embed/translate 와 동일하게 **web → Spring → ai** 를 따른다 (Next 가 ai 를 직접 호출하지 않음).

```
[클라이언트] 자연어 문장 + "추천 받기" 클릭
  → [Next route] POST /api/recommend-nl        (얇은 프록시; translate 라우트 패턴)
  → [Spring] POST /api/v1/recommend/nl
       · 레이트 리밋 검사 (인메모리 토큰버킷; IP/사용자)  → 초과 시 429
       · 입력 정규화 → 파싱 캐시 조회 (Postgres nl_profile_cache) → 적중 시 파싱 생략
       · AiClient → POST /internal/parse-profile (규칙 우선 + LLM 폴백) → RecommendProfile
       · 캐시 저장
       · 기존 추천 재사용: 프로필 임베딩(/internal/embed, 로컬 모델)
                         → pgvector findSemanticCandidates(top 50)  → 6차원 스코어러
  → RecommendResponse(recommendations[].score: 6차원)
  → [클라이언트] RecommendationCard + ScoreBreakdownBars 재사용 렌더
```

비용이 발생하는 외부 호출은 **5.2 의 LLM 폴백뿐**(그것도 규칙 실패 시에만). 임베딩·스코어링·후보 검색은 전부 로컬/DB(pgvector).

### 5.4 상태

- **미입력/비로그인**: 입력창 + 예시 문구만
- **로딩**: 스켈레톤/스피너
- **결과**: 추천 카드(최종 점수 + 6차원 색 막대 + 핵심 이유), 6차원 범례, "더 보기 → /recommend"
- **에러**: 백엔드/AI 미연결 시 섹션 내 안내 + `/search` 로 폴백 유도, 페이지는 정상

### 5.5 비용 / 어뷰즈 통제 (필수)

레이트 리밋·캐시는 **Spring 백엔드(Railway, 상태 유지되는 단일 컨테이너)** 에 둔다. web=Vercel(서버리스)이라 Next 라우트의 인메모리 상태는 휘발·비공유이므로 부적합. **Redis 는 v1 에서 쓰지 않는다** — 단일 인스턴스 인메모리 + 기존 Postgres 로 충분.

1. **명시적 클릭 호출만** — 키 입력마다 호출 금지
2. **입력 캐싱** — 정규화된 문장 해시 키로 파싱 결과 재사용. **Neon Postgres 소형 테이블** `nl_profile_cache(input_hash, profile_json, created_at)` — 재배포에도 유지, 기존 DB 재사용 (Redis 불필요)
3. **레이트 리밋** — **Spring 인메모리 토큰버킷**(단일 인스턴스). 익명 IP/세션당(예: 시간당 10회) + 로그인 사용자당 별도 한도. 초과 시 `429`
4. **프롬프트 봉인** — LLM 폴백은 JSON 모드 + `max_tokens` ~200 + 스키마 검증, 비준수 출력 거부 ("공짜 LLM" 악용 차단)
5. **입력 길이 제한** — ~200자 (초과 시 `400`)
6. **예산 캡 + 알림** — OpenAI 키 월 상한 및 임계 알림

> Redis 도입 트리거: 백엔드를 다중 인스턴스로 수평 확장하거나 분산 레이트리밋이 필요해질 때. 현재(Beta·개인용·단일 인스턴스)는 불필요.

### 5.6 RAG 미적용 — 의도된 결정

추천은 **검색(임베딩 유사도)은 쓰되 생성(LLM)은 쓰지 않는다.** RAG = 검색 + LLM 생성인데, 추천이 하는 일은 "기존 공고를 순위 매기는" 판별/랭킹이지 텍스트 생성이 아니다. 출력은 점수가 매겨진 공고 리스트(`scorer.py` 의 6차원 점수)이며 LLM 생성물이 아니다.

추천에 LLM 생성을 얹으면 (1) 공고 컨텍스트를 매 요청 프롬프트에 넣어 비용 폭증, (2) 결정론적 스코어러 대비 환각·순위 불안정 위험이 생긴다. 따라서 추천에는 RAG를 적용하지 않는다.

RAG 의 적정 위치는 **AI 커리어 어시스턴트 챗봇(스펙 3)** — 공고/회사/비자 근거를 검색해 근거 기반 답변을 생성. 검색 substrate 는 **이미 존재한다**: `V1__init_schema.sql` 에 `CREATE EXTENSION vector`, `jobs.embedding VECTOR(384)`, `ivfflat (embedding vector_cosine_ops)` 인덱스가 있고 추천이 `findSemanticCandidates` 로 이를 사용 중이다. 따라서 챗봇은 이 pgvector 인프라를 그대로 재사용하면 된다. 공고 요약(스펙 2)은 생성이나 단일 문서 요약이라 RAG 아님.

### 5.7 프로필 소스 무관 설계 (미래 B 대비)

추천 섹션은 `RecommendProfile` 을 받아 렌더하도록 만들고, 그 프로필이 **자연어 파싱 결과인지 저장된 프로필인지 구분하지 않는다.** 후속 증분(가입 프로필 캡처·저장)이 추가되면:
- 로그인 + 저장 프로필 → 프로필 기반 자동 표시 + "오늘은 다른 거?" 자연어 재정의
- 비로그인 → 자연어 입력 + "프로필로 저장/가입" CTA

이때 추천 섹션 컴포넌트와 6차원 엔진은 수정 불필요.

## 6. 비주얼 디자인 (하이브리드 C)

- `web/DESIGN.md` 토큰 준수. grayscale + indigo(primary) 기본, **의미색만 강조**: 비자=success(green), 6차원 점수=`domain_tokens.score` 6색
- Hero: 은은한 violet 그라데이션(라이트), 다크는 zinc-950 단색 + 미세 글로우. display 타이포 + indigo 버튼
- 카드/간격/radius/shadow 전부 기존 토큰 → 기존 페이지와 이질감 없음, 라이트/다크 동등

## 7. 컴포넌트

**재사용**: `JobCard`, `VisaBadge`, `SearchBar`, `RecommendationCard`, `ScoreBreakdownBars`, `ui/Card`, `ui/Button`, `ui/Input`

**신규** (`web/components/home/`):
- `Hero` — 카피 + 검색바 + 그라데이션
- `NlRecommend` (클라이언트) — 자연어 입력 + 상태 관리 + 결과(RecommendationCard 재사용)
- `JobScrollRow` — 가로 스크롤 행(JobCard 재사용) — 비자 섹션
- `CountryTiles` — 국가 타일
- `CompanySpotlight` — 회사 카드 그리드
- `SectionHeader` — 제목(+의미색 점) + "전체 보기" 링크 공통

## 8. 백엔드 / AI 변경

- **ai 서비스**: 자연어→프로필 파싱 엔드포인트 `POST /internal/parse-profile` 1개 추가 (규칙 우선 + gpt-4o-mini 폴백, 기존 OpenAI 연동 재사용)
- **Spring 백엔드**: `POST /api/v1/recommend/nl` 추가 (레이트리밋 + 파싱 캐시 + ai parse 호출 + **기존 추천 로직 재사용**) · `AiClient` 에 `parseProfile` 메서드 추가 · `nl_profile_cache` 테이블 마이그레이션 추가. 기존 `/api/v1/jobs`·`/api/v1/companies`·`/api/v1/recommend` 는 변경 없음
- **Next.js**: `POST /api/recommend-nl` 얇은 프록시 (translate 라우트 패턴, BACKEND_URL 로 위 Spring 엔드포인트 호출)
- 국가별 공고 수 뱃지는 location facet 부재로 v1 생략 (후속: facet 추가 시 부착)

## 9. 반응형 / 다크모드

- 모바일: 가로 스크롤 행은 스와이프 유지, 그리드 1열, 국가 타일 2열, Hero 타이포 축소
- 다크모드: 기존 `next-themes` + DESIGN.md 다크 토큰 그대로

## 10. 에러 / 빈 상태 / 성능

- 섹션별 독립 fetch + 실패 격리 (한 섹션 실패가 페이지 전체를 죽이지 않음)
- 데이터 0건 섹션은 숨김(국가 타일 제외)
- 백엔드 전체 다운 시: Hero·국가 타일·맞춤 추천 입력창은 표시, 공고 섹션은 안내 후 숨김
- `dynamic = "force-dynamic"` 유지

## 11. 검증

- 백엔드 기동 상태에서 `/` 렌더 → 각 섹션 데이터 표시 확인
- 자연어 입력 → 추천 결과(점수 막대) 표시, 캐시 적중 시 LLM 미호출 확인
- 레이트 리밋 초과 시 차단 응답 확인
- 백엔드 종료 상태에서 graceful 확인
- 모바일 뷰포트, 라이트/다크 토글
- `/search` 이동 및 기존 검색 동작 회귀 확인

## 12. 미해결 / 미래 증분

- 가입 프로필 캡처·저장 → 프로필 기반 추천 (5.7)
- AI 공고 요약 (스펙 2), AI 커리어 어시스턴트 챗봇 (스펙 3)
- **검색 엔진**: 스펙 1 에선 검색을 `/search` 로 **이동만** 함(동작 변경 없음). 현재 `q` 는 `LIKE '%...%'`(인덱스 미사용). 다음 증분 = **Postgres 전문검색**(tsvector + GIN + `ts_rank`, 필요 시 `pg_trgm` 오타 보정) — 신규 인프라 0. **Elasticsearch 는 도입 안 함**, 트리거(활성 공고 ~100만 / PG FTS 로 안 풀리는 관련도·지연 / 동의어·다국어 분석기·자동완성 필요) 충족 시에만 관리형 OpenSearch 검토
- 국가별 공고 수 facet, 레이트 리밋/캐시의 Redis 전환(다중 인스턴스)
- 추천 결과 피드백 학습(기존 `record_recommendation_feedback` 연계)
