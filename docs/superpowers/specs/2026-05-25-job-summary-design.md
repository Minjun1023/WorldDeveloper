# AI 공고 요약 — 설계 (스펙 2)

작성일: 2026-05-25
상태: 검토 대기

## 1. 개요 / 목표

긴 영문 공고 본문을 **한국어 구조화 요약(4섹션)**으로 보여준다. 한국 개발자가 공고를 빠르게 스캔하도록 돕는다. 기존 **번역 기능과 동일한 패턴**(공고 상세 → 온디맨드 → OpenAI → DB 영구 캐시)을 미러링한다.

이 기능은 단일 문서(해당 공고) 요약이므로 **생성이지만 RAG 아님** (검색 단계 불필요).

## 2. 범위

**포함**
- ai `/internal/summarize` (gpt-4o-mini, 영문→한국어 4섹션 JSON)
- `job_summaries` 캐시 테이블 (V6) + Spring `GET /api/v1/jobs/{id}/summary`
- Next 프록시 `POST /api/job-summary`
- 공고 상세 페이지의 `JobSummary` 온디맨드 컴포넌트

**제외**
- 카드/검색 결과의 요약 표시 (상세 페이지에만; 추후)
- 자동 요약(페이지 로드 시) — 온디맨드만 (비용)
- 영어 외 다국어 요약 — `lang=ko` 만 (구조는 lang 파라미터로 확장 가능)

## 3. 아키텍처

기존 번역(`TranslationController`/`TranslationService`/`job_translations`/ai `/internal/translate`)을 그대로 미러링한다.

```
[공고 상세] "AI 요약 보기" 클릭
  → [Next] POST /api/job-summary {job_id, lang:"ko"}        (translate 라우트 패턴)
  → [Spring] GET /api/v1/jobs/{id}/summary?lang=ko
       · SummaryService.getOrCreate(id, lang)
       · job_summaries 캐시 조회 → 적중 시 즉시 반환 (AI 호출 0)
       · 미스 → AiClient.summarize(title, description) → JSON → 캐시 저장
       · AI 미설정/오류 → 503
  → [ai] POST /internal/summarize {title, description}
       · gpt-4o-mini, JSON 모드, max_tokens ~500 → 4섹션 한국어 불릿
  → [프론트] 4섹션 렌더
```

비용 발생 외부 호출은 **캐시 미스 시 ai 요약 1회뿐**. 캐시 적중 시 0.

## 4. ai 엔드포인트 — `POST /internal/summarize`

ai 서비스(FastAPI)에 추가. `translate.py` 와 동일한 httpx/`response_format: json_object`/`settings.openai_api_key` 패턴.

### 요청
```json
{ "title": "Senior Backend Engineer", "description": "<영문 공고 본문>", "lang": "ko" }
```
| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `title` | string | | 컨텍스트용 |
| `description` | string | ✓ | 영문 본문 (max ~20,000자, translate 와 동일) |
| `lang` | string | | 기본 `"ko"` |

### 응답 200
```json
{
  "responsibilities": ["주요 업무 불릿", "..."],
  "requirements": ["자격 요건 불릿", "..."],
  "visa": ["비자/이주 관련 불릿", "..."],
  "compensation": ["연봉/복지 불릿", "..."],
  "engine": "gpt-4o-mini"
}
```
- 본문에 해당 정보가 없으면 **빈 배열** (예: 비자 언급 없음 → `"visa": []`). LLM 은 추측하지 않고 본문 근거만 요약하도록 지시.
- 시스템 프롬프트: "다음 채용 공고를 한국어로 요약. 기술명·회사명·도구명은 영어 유지. 본문에 명시된 내용만, 4개 키(responsibilities/requirements/visa/compensation)의 JSON 배열로만 응답. 각 배열은 간결한 불릿 3~6개(없으면 빈 배열)."

### 상태 코드
| 코드 | 의미 |
|---|---|
| 200 | 정상 |
| 400 | `description` 빈값 |
| 503 | `OPENAI_API_KEY` 미설정 (translate 와 동일 — 백엔드가 503 전달) |
| 502 | OpenAI 업스트림 오류 |

## 5. DB 캐시 — `job_summaries` (V6 마이그레이션)

`job_translations` 와 동일 구조. 공고+언어당 1회만 요약.

```sql
CREATE TABLE IF NOT EXISTS job_summaries (
    job_id       TEXT NOT NULL,
    lang         TEXT NOT NULL,
    summary_json TEXT NOT NULL,      -- ai 응답 4섹션 JSON 직렬화
    engine       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (job_id, lang),
    CONSTRAINT fk_job_summaries_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
);
```

## 6. Spring `GET /api/v1/jobs/{id}/summary?lang=ko`

`TranslationController`/`TranslationService` 미러.
- `SummaryController` (`@RequestMapping("/api/v1/jobs/{id:.+}")`, `@GetMapping("/summary")`) — 공개(인증 불필요).
- `SummaryService.getOrCreate(id, lang)`: `JobSummaryRepository` 캐시 조회 → 미스 시 `AiClient.summarize` 호출 → 저장. 공고 없으면 `Optional.empty()`(404). AI 미설정/오류 시 `SummaryUnavailableException` → 503.
  - 저장 규칙: `summary_json` = 4섹션 배열 객체(`{responsibilities,requirements,visa,compensation}`) JSON 직렬화, `engine` = 엔진명(별도 컬럼). 캐시 읽기 시 `summary_json` 역직렬화 + `engine` 을 합쳐 `SummaryDto` 구성.
- `AiClient.summarize(title, description)` 메서드 추가 (embed/translate 와 동일 JDK HttpClient 패턴) → ai `/internal/summarize` 호출, JSON → `SummaryDto`.
- DTO: `SummaryDto(List<String> responsibilities, List<String> requirements, List<String> visa, List<String> compensation, String engine)`.

기존 `TranslationController` 와 같은 베이스 경로(`/api/v1/jobs/{id:.+}`)에 다른 서브경로(`/summary`)라 충돌 없음.

## 7. Next 프록시 — `POST /api/job-summary`

`web/app/api/translate/route.ts` 미러. `{job_id, lang}` 받아 `${BACKEND_URL}/api/v1/jobs/{job_id}/summary?lang={lang}` GET 호출, 상태코드 패스스루, 503/404 전달, 타임아웃 ~75s(LLM).

## 8. 프론트 — `JobSummary` 컴포넌트

`web/components/job/JobSummary.tsx` (`"use client"`), 공고 상세 페이지에서 **상세 설명(JobDescription) 위**에 배치.
- 기본: "AI 요약 보기" 버튼만 (온디맨드).
- 클릭 → `POST /api/job-summary` → 4섹션 카드 렌더:
  - 주요 업무 (responsibilities)
  - 자격 요건 (requirements)
  - 비자·이주 (visa)
  - 연봉·복지 (compensation)
- 빈 배열 섹션은 **숨김**. 모든 섹션이 비면 "요약할 핵심 정보를 찾지 못했습니다".
- 상태: idle / loading("요약 중…") / error / result. 결과는 컴포넌트 상태 + DB 캐시(재방문 시 캐시 적중).
- 503 → "AI 요약 사용 불가 (API 키 미설정)". 기타 오류 → 안내. 페이지는 정상.
- 타입: `JobSummary` 응답 타입을 `web/lib/types.ts` 에 추가.

## 9. 에러 / 빈 상태

- AI 키 미설정 → 503 → 버튼 영역에 안내, 원문/번역은 그대로 사용 가능.
- 본문이 매우 짧거나 비면 → ai 가 빈 배열 위주 반환 → "핵심 정보 부족" 안내.
- 백엔드/ai 다운 → 502 → 안내, 페이지 정상.

## 10. 비용 통제

- **온디맨드 클릭에만** 호출 (자동 X).
- **공고+언어당 1회 캐시** (`job_summaries`) → 같은 공고 재요약 없음.
- gpt-4o-mini, `max_tokens` ~500, JSON 모드 (출력 상한).
- 번역과 동일한 비용 프로파일 (저렴).

## 11. 검증

- ai: pytest — `/internal/summarize` 가 키 없을 때 503, 구조(4키) 응답 형태. (LLM 실제 호출은 키 필요 → 키 없을 때 503 경로 테스트, 실제 요약은 라이브.)
- backend: JUnit — `SummaryService.getOrCreate` 캐시 적중/미스 로직(가능하면 mock), `compileJava`. 통합 curl(라이브)로 캐시 동작 확인.
- web: typecheck/build + 라이브에서 실제 공고로 "AI 요약 보기" → 4섹션 렌더, 재클릭 시 캐시(2번째 ai 호출 없음).

## 12. 미해결 / 미래 증분

- 카드/검색 결과에 요약 미리보기 (현재 상세만)
- 다국어 요약 (lang 확장)
- 번역본 기반 요약 옵션 (현재는 영문 원문 요약)
- 요약 캐시 TTL/무효화 (공고 본문 변경 시 — 현재 공고는 사실상 불변)
