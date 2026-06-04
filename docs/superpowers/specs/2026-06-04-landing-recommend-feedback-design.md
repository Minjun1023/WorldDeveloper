# 랜딩 회원 맞춤 추천 + 피드백 수집 인프라 — 설계 (기능 A)

날짜: 2026-06-04
상태: 설계 승인 대기(스펙 리뷰)
대상: backend(Spring) + web(Next.js). AI 추천 엔진은 재사용(신규 학습 없음).

## 배경 / 동기

회원가입 프로필 기반 추천([[member-profile-recommend]], `/recommend/me` — 6차원 스코어링+임베딩)은 이미 있으나, **로그인 회원도 랜딩에선 `/recommend` 링크만** 본다(`HeroSearch` AI 탭). 사용자는 (1) 프로필 맞춤 공고를 **랜딩에 직접 노출**하고, (2) 추후 추천 품질 학습의 토대가 될 **피드백을 수집**하길 원한다.

**"학습"의 현실:** 신규 서비스라 클릭/지원 등 상호작용 데이터가 아직 없다(콜드스타트). 따라서 지금은 **기존 휴리스틱+임베딩 추천을 그대로 노출**하고, **피드백 수집 인프라만 구축**한다. 데이터가 쌓이면 나중에 learning-to-rank/가중치 튜닝으로 확장(이번 범위 밖). 무거운 로컬 학습은 하지 않는다.

## 승인된 결정 사항

- 추천 엔진: 기존 `/recommend/me` 재사용. 신규 모델 학습 없음.
- 랜딩 배치: **상단 전용 "회원님 맞춤 공고" 섹션**(로그인+프로필 회원에게만, 기존 섹션 위). 비회원/무프로필은 기존 티저/CTA. 히어로 무변경.
- 피드백 신호: **풀세트** — 노출(impression)·클릭(click)·지원클릭(apply_click)·저장(save)·좋아요/싫어요(like/dislike).
- 저장: 하트 토글 + **`/me/saved` 목록 페이지**까지.
- dislike는 추후 추천에서 제외.

## 1. 데이터 모델 (신규 마이그레이션 V12)

"현재 상태" 2테이블 + "이벤트 로그" 1테이블 (각자 단일 책임). users.id 는 UUID(V1). job_id 는 text(jobs.id 형식, 예 `greenhouse:dropbox:123`).

```sql
-- 현재 북마크 (source of truth for /me/saved + 하트 상태)
CREATE TABLE saved_jobs (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id     TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_saved_jobs_user ON saved_jobs(user_id, created_at DESC);

-- 현재 좋아요/싫어요 (토글). dislike 는 추천 제외에 사용.
CREATE TABLE job_reactions (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id     TEXT NOT NULL,
    reaction   TEXT NOT NULL CHECK (reaction IN ('like','dislike')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, job_id)
);

-- append-only 이벤트 로그 (학습용 CTR 등). rank/score 컨텍스트 보존.
CREATE TABLE recommendation_feedback (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id     TEXT NOT NULL,
    action     TEXT NOT NULL CHECK (action IN ('impression','click','apply_click')),
    rank       INT,
    score      REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rec_feedback_user ON recommendation_feedback(user_id, created_at DESC);
```

- 저장/반응의 "발생 시점"이 학습에 필요하면 created_at/updated_at 으로 충분(이벤트 로그 중복 불필요).
- job_id 에 jobs FK 를 걸지 않는다(공고는 ETL 로 비활성/교체될 수 있어 과거 피드백 보존 위해 느슨 결합; jobs 만료와 독립).

## 2. 백엔드 (Spring) — 인증 필요 엔드포인트

`@AuthenticationPrincipal String userId` → UUID. 신규 `feedback` 패키지(엔티티/repo/서비스/컨트롤러). 보안: `/api/v1/me/**` 는 이미 `.authenticated()`([[member-profile-recommend]] SecurityConfig).

- `PUT  /api/v1/me/saved/{jobId}` — 멱등 insert(ON CONFLICT DO NOTHING). 200.
- `DELETE /api/v1/me/saved/{jobId}` — 삭제. 200.
- `GET  /api/v1/me/saved` — 저장 공고 **전체 DTO**(JobListItem 형식, 최신순). 비활성 공고는 제외하거나 표시(구현 시 is_active 필터, 저장 시점 보존이지만 만료 공고는 숨김).
- `PUT  /api/v1/me/reactions/{jobId}` — body `{reaction:"like"|"dislike"}`, upsert(전환 가능). 200.
- `DELETE /api/v1/me/reactions/{jobId}` — 반응 해제. 200.
- `POST /api/v1/me/feedback` — body `{events:[{job_id, action, rank?, score?}]}`, bulk insert(append-only). action ∈ impression|click|apply_click. 검증: 알 수 없는 action 거절, 배열 길이 상한(예 ≤100). 202.
- `GET  /api/v1/me/interactions` — `{ saved:[jobId...], reactions:{jobId:"like"|"dislike"} }` (카드 UI 상태 일괄).

**추천 dislike 제외:** `MeRecommendController.recommend` 가 사용자 dislike job_id 집합을 로드 → 추천 결과에서 post-filter(약간 over-fetch 후 제외해 topK 유지). 엔진/`RecommendService` 시그니처는 유지(컨트롤러에서 후처리).

## 3. 웹 (Next.js)

**랜딩 상단 섹션** — `app/page.tsx`: 비회원은 섹션 미렌더(기존 그대로). 로그인 회원이면 클라이언트 컴포넌트 `MemberLandingRecommend` 를 기존 섹션 위에 렌더:
- 마운트 시 `/api/me/recommend`(POST, note 없음) + `/api/me/interactions` 병렬 호출.
- 409(무프로필) → "프로필을 작성하면 맞춤 공고를 받을 수 있어요" + `/me/profile` CTA.
- 추천 있음 → "회원님 맞춤 공고" 카드 그리드(상위 N=6) + "더 보기→/recommend".
- 렌더 직후 노출 이벤트 일괄 기록.

**카드 인터랙션** — `InteractiveJobCard`(기존 `RecommendationCard` 를 감싸고 인터랙션 바 추가, RecommendationCard 는 선택적 props 로 재사용성 유지):
- 하트(저장) 토글 → `/api/me/saved` PUT/DELETE (낙관적, 실패 revert).
- 엄지(좋아요/싫어요) → `/api/me/reactions` PUT/DELETE; **dislike 시 목록에서 즉시 제거**.
- 카드 클릭 → `/api/me/feedback {click}` 후 상세 이동; 지원 링크 클릭 → `{apply_click}`.
- 초기 하트/엄지 상태는 interactions 번들로 채움.
- 피드백 POST 는 fire-and-forget(실패해도 UX 무영향, 콘솔 경고만).

**`/me/saved` 페이지** — `app/me/saved/page.tsx`(미들웨어 `/me/*` 보호). `GET /api/me/saved` → 저장 공고 카드(해제 가능). 빈 상태 안내. `AccountMenu` 에 "저장한 공고" 링크 추가.

**인증 프록시 라우트(신규)** — `getSessionToken` 패턴: `app/api/me/saved/route.ts`(GET) + `app/api/me/saved/[jobId]/route.ts`(PUT/DELETE), `app/api/me/reactions/[jobId]/route.ts`(PUT/DELETE), `app/api/me/feedback/route.ts`(POST), `app/api/me/interactions/route.ts`(GET).

**피드백 배칭 유틸** — 노출 이벤트를 모아 1회 POST 하는 작은 클라이언트 유틸(`lib/feedback.ts`): `recordImpressions(items)`, `recordEvent(jobId, action, ctx)`.

## 재사용 / 경계

| 신규 | 재사용 |
|---|---|
| V12 3테이블, feedback 백엔드(엔티티/repo/서비스/컨트롤러), saved/reactions/feedback/interactions 엔드포인트, 랜딩 섹션, InteractiveJobCard, /me/saved, 프록시 5종, feedback 유틸 | `/recommend/me`·RecommendService·스코어러, RecommendationCard·점수 UI, 인증/세션/프록시 패턴, SecurityConfig `/me/**` 게이트, getSessionToken |

## 검증 계획

- 백엔드(Testcontainers): saved PUT/DELETE/GET·멱등성, reactions upsert/전환/삭제, feedback bulk insert·검증(상한·알수없는 action), interactions 번들, **dislike 추천 제외**(MeRecommend post-filter). 401 비인증.
- 웹: Vitest(InteractiveJobCard 낙관적 토글·dislike 즉시제거·feedback 배칭 유틸), typecheck/lint/build.
- 라이브(Playwright): 비회원 랜딩에 섹션 없음 / 무프로필 회원 CTA / 프로필 회원 맞춤 섹션 + 저장 토글 + /me/saved 반영 + dislike 후 재진입 시 제외 + 클릭/지원 이벤트 DB 기록.

## 스코프 제외(후속)

- learning-to-rank/가중치 튜닝(데이터 축적 후), 저장 공고 알림, 피드백 분석 대시보드. 기능 B(대화형 이력서 상담봇)는 별도 스펙.
