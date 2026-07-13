# dev-jobs-mcp

해외 개발자 채용 공고를 위한 MCP 서버 (v0.6). 여러 데이터 소스에서 공고를 통합 검색하고, **다국어 비자 스폰서십 분류**(영/독/네/일), 기술 스택 기반 이력서 매칭, 개인화 추천, 지원 추적, 회사 정보 통합, 인터뷰 준비, 이력서 최적화, 거절 회복까지 채용 활동 전반을 돕는다.

**26개 tool** 을 5개 역할 그룹 (Scout / Analyst / Strategist / Tracker / Recovery) 으로 제공.

## 설치

```bash
cd dev-jobs-mcp
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .

# 추천의 의미 유사도(임베딩)까지 쓰려면 (선택, 권장):
pip install -e ".[embeddings]"
```

## Claude Code 연결

```bash
claude mcp add dev-jobs -s user -- /절대/경로/dev-jobs-mcp/.venv/bin/python -m dev_jobs_mcp.server
claude mcp list   # dev-jobs ✓ Connected 확인
```

## Claude Desktop 연결

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) 또는
`%APPDATA%\Claude\claude_desktop_config.json` (Windows) 에 추가:

```json
{
  "mcpServers": {
    "dev-jobs": {
      "command": "/절대/경로/dev-jobs-mcp/.venv/bin/python",
      "args": ["-m", "dev_jobs_mcp.server"],
      "env": { "RAPIDAPI_KEY": "" }
    }
  }
}
```

JSearch 를 쓰려면 `RAPIDAPI_KEY` 에 키를 넣고, 안 쓸 거면 비워두거나 env 블록을 빼면 된다.

## 제공 Tools (26개, 역할 그룹별)

채용 워크플로우는 `Scout → Analyst → Strategist → Tracker → Recovery → (Scout)` 사이클로 흐른다.
`list_disciplines()` 로 전체 그룹을, `list_disciplines("scout")` 로 특정 그룹 상세를 조회할 수 있다.

### Scout — 탐색·필터

| Tool | 설명 |
|---|---|
| `search_dev_jobs` | 키워드/지역/원격/비자 필터로 멀티 소스 통합 검색 (토큰 AND 매칭) |
| `list_company_jobs` | 특정 회사의 모든 공고 직접 조회 (Greenhouse/Lever/Ashby) |
| `find_visa_sponsors` | 비자 스폰서십 명시 공고만 (evidence 포함) |
| `find_companies` | 레지스트리에서 태그(fintech/europe 등)로 회사 검색 |
| `check_new_jobs` | 마지막 체크 이후 신규 공고만 (SQLite 추적) |

### Analyst — 분석·평가

| Tool | 설명 |
|---|---|
| `get_job_details` | job_id 로 단일 공고 상세 + 비자/스택 자동 분석 |
| `get_company_intel` | 회사 평판 — HN Algolia 최근 멘션 + 신호 |
| `match_resume_to_job` | 이력서 vs 공고 기술 스택 갭 분석 |
| `get_salary_insights` | 직무/지역별 USD 연봉 통계 (시간당 임금 sanity check 포함) |

### Strategist — 추천·계획

| Tool | 설명 |
|---|---|
| `recommend_jobs` | 사용자 프로필 기반 6차원 점수 추천 (하이브리드 + 학습 옵션) |
| `prepare_application_kit` | 지원 준비 원샷: 공고+비자+스킬+회사+talking points 통합 |
| `generate_interview_prep` | 단계별(phone_screen/take_home/onsite/system_design/behavioral) 준비 |
| `ultrawork` | **한 호출로 검색→추천→회사 인텔→다음 행동까지 (omo 패턴)** |

### Tracker — 기록·모니터링

| Tool | 설명 |
|---|---|
| `track_application` | 공고 지원 상태 추적/업데이트 |
| `list_applications` | 추적 중인 지원 목록 |
| `get_pipeline_summary` | 단계별 funnel 통계 + 합격률 |
| `get_application_history` | 특정 공고의 상태 변경 이력 |
| `subscribe_company_blog` | 회사 RSS/Atom 피드 구독 |
| `unsubscribe_company_blog` | 구독 해제 |
| `list_blog_subscriptions` | 구독 목록 |
| `check_new_blog_posts` | 신규 글 감지 (SQLite seen tracking) |
| `record_recommendation_feedback` | 추천 +/- 피드백 (학습용) |
| `get_feedback_summary` | 누적 피드백 + 학습된 가중치 보너스 |

### Recovery — 회복·재시도

| Tool | 설명 |
|---|---|
| `find_recovery_path` | 거절된 공고 → 비슷한 회사 추천 + 다음 행동 + 통계 |
| `optimize_resume_for_job` | 공고 키워드 매칭 + 이력서 줄 재배치 제안 |

### Meta

| Tool | 설명 |
|---|---|
| `list_disciplines` | 5개 역할 그룹 전체/상세 조회 (어떤 상황에 어떤 tool 군을 쓸지 안내) |

## 데이터 소스

- **RemoteOK** (`remoteok.com/api`) — 원격 개발자 공고. 키 불필요.
- **Arbeitnow** (`arbeitnow.com/api`) — 유럽 + 원격. 키 불필요.
- **Greenhouse** (`boards-api.greenhouse.io`) — 회사별 직접 조회. 키 불필요.
- **Lever** (`api.lever.co`) — 회사별 직접 조회. 키 불필요.
- **Ashby** (`api.ashbyhq.com`) — Linear, Vercel, Posthog 등 신생 유니콘. 키 불필요.
- **HN Algolia** (`hn.algolia.com/api/v1`) — 회사 평판/언급 조회. 키 불필요.
- **JSearch** (RapidAPI, 선택) — LinkedIn/Indeed/Glassdoor 보강. `RAPIDAPI_KEY` 있으면 자동 활성화.

## 회사 레지스트리

`dev_jobs_mcp/data/companies.json` 에 50+개 테크 회사가 ATS 매핑과 태그로 등록됨.

```json
{
  "stripe":  {"ats": "greenhouse", "token": "stripe",  "tags": ["fintech", "payments"]},
  "linear":  {"ats": "ashby",      "token": "linear",  "tags": ["productivity", "devtools"]},
  "spotify": {"ats": "lever",      "token": "spotify", "tags": ["consumer", "music", "europe"]}
}
```

> "유럽 핀테크 회사 공고 보여줘"
> → `find_companies(tags=["fintech", "europe"])` → 매칭 회사들
> → 각각 `list_company_jobs(company=...)` 로 조회

회사 추가는 JSON 파일에 항목만 추가하면 끝.

## 다국어 비자 분류

비자 스폰서십을 영어 + 독일어 + 네덜란드어 + 일본어 4종 패턴으로 분류한다.

| status | 의미 | 예시 패턴 |
|---|---|---|
| `sponsors` | 명시적 제공 | "visa sponsorship", "Blaue Karte", "kennismigrant", "就労ビザ支援" |
| `no_sponsor` | 명시적 거부 | "no sponsorship", "keine Visumssponsoring", "geen visumsponsoring", "ビザサポートなし" |
| `unclear` | 언급 없음 | (대부분의 공고) |

**negation 처리**: "we are **not able to** provide visa sponsorship", "relocation support **is not available**" 같은 부정문은 매칭 주변(앞 40자/뒤 50자)의 부정어를 감지해 `no_sponsor` 로 분류한다.

`visa_evidence` 필드에 매칭된 원문 단편을 함께 반환하므로, Claude 가 최종 판단을 보정할 수 있다. 분류 결과만 믿지 말고 evidence 와 description 도 같이 봐야 한다.

## 추천 시스템 (recommend_jobs)

규칙 기반 점수화 + 임베딩 의미 유사도 하이브리드.

### 점수 구성 (기본 가중치)

| 차원 | 가중치 | 의미 |
|---|---|---|
| 스택 매칭 | 0.35 | 사용자 스킬과 공고 요구 기술 교집합 비율 |
| 비자 적합도 | 0.20 | sponsors / unclear / no_sponsor 분류 |
| 지역 적합도 | 0.15 | 선호 지역 일치 또는 원격 |
| 시니어리티 | 0.10 | 제목/description 에서 추출한 레벨 매칭 |
| 연봉 | 0.10 | 공개된 연봉이 희망 이상인지 |
| 의미 유사도 | 0.10 | 이력서/bio ↔ 공고 description 임베딩 |

### Deal-breaker 패널티

- 사용자 비자 필요 + 공고 `no_sponsor` → 점수 × 0.1
- 사용자 원격 only + 공고 온사이트 → 점수 × 0.2
- 사용자 제외 회사 → 점수 = 0

### 피드백 학습 (옵션)

`record_recommendation_feedback` 로 +/- 피드백을 5건 이상 쌓으면, `recommend_jobs(use_learned_weights=True)` 호출 시 positive 추천에서 강했던 차원에 가중치 보너스가 자동 적용된다. (단순 룰 기반 — 진짜 ML 아님)

### 임베딩 (선택, 권장)

미설치 시 의미 유사도 점수가 0으로 처리되고 나머지는 정상 동작.

```bash
pip install -e ".[embeddings]"
```

다국어 모델 (`paraphrase-multilingual-MiniLM-L12-v2`, 약 470MB) → 한글 이력서 ↔ 영어 공고 매칭. 첫 호출 시에만 다운로드. (참고: 자연 한글은 매칭이 약하고 외래어는 잘 됨 — 이력서는 영어 권장)

### 사용 예시

```python
recommend_jobs(
    skills=["python", "django", "postgresql", "aws"],
    seniority="senior", years_experience=7,
    needs_visa_sponsorship=True,
    preferred_locations=["Berlin"],
    remote_preference="hybrid_ok",
    desired_salary_usd=80000,
    target_companies=["stripe", "notion"],
    top_k=10,
)
```

각 결과에 `score_breakdown` (차원별 점수) 과 `reasons` (추천 이유) 가 포함되어 "왜 추천했는지" 설명 가능. 가중치는 `weights={"visa": 0.4, ...}` 로 커스터마이즈.

## ultrawork — 통합 워크플로우 (omo 패턴)

[oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) 의 `ultrawork` 패턴을 채용 도메인에 적용. 한 번 호출로 검색 → 추천 → 회사 인텔 → 다음 행동 제안까지 chain.

```python
ultrawork(
    skills=["python", "django", "aws"],
    seniority="senior", years_experience=7,
    needs_visa_sponsorship=True,
    preferred_locations=["Berlin", "Amsterdam"],
    top_k=10, enrich_top=3, include_intel=True,
)
```

상위 `enrich_top` 개 회사에만 HN 인텔을 병렬 보강해 외부 API 호출 폭증을 막는다. 반환 구조: `recommendations` / `enriched_top_picks` / `aggregate_insights` / `next_actions`.

## 지원 추적 워크플로우

```
검색 → 추천 → 관심 등록 → 지원 → 인터뷰 진행 → 결과
search   recommend  interested  applied  phone_screen/onsite  offer/accepted/rejected
                    ↓
                  track_application(job_id, status="interested")
```

`~/.dev-jobs-mcp/applications.db` 에 SQLite 로 저장. 상태 변경마다 이벤트 기록 → 전체 이력 조회 가능. 거절 시 `find_recovery_path` 로 비슷한 회사 + 다음 행동 제안.

## 회사 ATS 토큰 찾는 법

회사 채용 페이지 URL 을 보면 됨:
- `boards.greenhouse.io/stripe` → token = `stripe`
- `jobs.lever.co/netflix` → token = `netflix`
- `jobs.ashbyhq.com/linear` → token = `linear`

## 데이터 저장 위치

- `~/.dev-jobs-mcp/applications.db` — 지원 추적 / 피드백 / RSS seen (SQLite)
- `~/.cache/huggingface/` — 임베딩 모델 캐시 (최초 다운로드 후)

## 관련 프로젝트

이 MCP 서버의 코어 모듈(`sources/`, `analyzers/`, `recommender/`)은 별도의 웹 서비스(`devpass/`)에서 재사용된다. 전체 사이트 설계는 `devpass/DESIGN.md` 참고.
