# 대화형 이력서 상담봇 (/me/coach) — 설계 (기능 B)

날짜: 2026-06-04
상태: 설계 승인 대기(스펙 리뷰)
대상: ai(OpenAI 호출) + backend(grounding 조립) + web(/me/coach 채팅 UI)

## 배경 / 동기

회원이 특정 공고/회사에 맞춰 이력서를 수정·핏 상담받는 **대화형 봇**. 기존 자산: 공고 상세의 키워드 이력서최적화(`coach.ResumeOptimizer`, LLM 아님), OpenAI gpt-4o-mini(summarize/parse-profile 패턴), 공고/회사 DB, 회원 프로필([[member-profile-recommend]]), 저장/추천 공고([[landing-recommend-feedback-feature]]). 대화형 채팅 인프라는 없음 → 신규.

**핵심 통찰:** 사용자가 **특정 공고 1건**을 고르므로 본격 벡터 RAG는 불필요. 그 공고의 JD+회사 정보를 **직접 컨텍스트로 주입**(grounding)한다. pgvector 검색 안 씀.

## 승인된 결정 사항

- **대화 형태**: 멀티턴 채팅, **세션 메모리**(대화기록 DB 미저장 — 클라이언트가 보유, 매 턴 전체 전송, 백엔드 무상태).
- **이력서**: 세션마다 붙여넣기(저장 안 함 — PII, 프라이버시 친화).
- **위치**: 전용 `/me/coach`(회원 전용). 공고는 **저장/추천 공고에서 선택**.
- **grounding**: 선택 공고 JD+회사 intel + **기존 키워드 ResumeOptimizer의 결정적 갭(present/missing)** + 회원 프로필 → 컨텍스트 주입. (벡터 RAG 아님.)
- **LLM**: OpenAI gpt-4o-mini(ai 서비스, summarize 패턴). 회원 전용 AI(기존 결정). 키 없으면 503(비활성).
- **스트리밍**: MVP 비스트리밍("작성 중…" 후 전체 응답).
- **정직 우선**: JD·이력서 근거만, 없는 경험 날조 금지, 진짜 갭은 갭으로.

## 1. 데이터 흐름 + 대화 계약

대화기록은 클라이언트가 보유. 매 턴 전체를 전송, 백엔드는 무상태 grounding 조립.

**요청** `POST /api/v1/me/coach` (인증):
```
{ "job_id": "<jobs.id>",
  "resume": "<이력서 전문, 저장 안 함>",
  "messages": [ {"role":"user"|"assistant","content":"..."}, ... ] }   // 직전 대화 + 마지막=새 사용자 메시지
```
**응답**: `{ "reply": "<assistant>" }`. 비스트리밍.

흐름:
1. 클라 전송(messages + job_id + resume)
2. 백엔드: 인증(userId) → 레이트리밋(`chat:` + userId, LLM 비용 가드) → 입력검증(messages 비어있지 않음·마지막 role=user·턴 ≤20·resume 길이 상한 예 20k) → 공고 로드(JobService; 없음/비활성 404) + 회사 intel(CompanyService) + 프로필(ProfileService) + 키워드 갭(`coach.ResumeOptimizer`(resume, job.description) → present/missing) → **grounding 문자열 조립**(JD truncate ~3–4k + 회사 + 갭 + 프로필 요약)
3. `AiClient.coachChat(context, resume, messages)` → ai `/internal/coach-chat`
4. ai: OpenAI chat `[system:가드레일, system:context+resume, ...messages]` → gpt-4o-mini → `{reply}`
5. 클라가 reply를 세션 기록에 추가

**토큰 관리:** JD truncate + 최근 N턴(예 ≤20)만 전달 + resume 상한. ai 측에서 description[:N] 식 보호.

**가드레일 시스템 프롬프트(정직):** "제공된 JD·이력서·키워드 갭에 **근거해서만** 조언한다. 이력서에 없는 경험·기술을 **지어내지 말 것**. 실제 경험을 공고에 맞게 어떻게 부각/재서술할지 제안하되, 진짜 부족한 부분은 솔직히 갭으로 알리고 보완 방향만 제시. 한국어로."

## 2. 백엔드 (Spring) + AI

**ai `/internal/coach-chat`** (`ai/app/routes/coach.py`, summarize.py 패턴):
- 입력 `{context:str, resume:str, messages:[{role,content}]}` → OpenAI `[system 가드레일, system context+resume, ...messages]` → gpt-4o-mini → `{reply}`. `OPENAI_API_KEY` 없으면 503. messages role 화이트리스트(user/assistant), content 길이 보호.

**백엔드 `CoachController`** (`com.devjobs.coach`, `POST /api/v1/me/coach`):
- `@AuthenticationPrincipal String userId` → UUID. 레이트리밋(`chat:`+userId).
- 검증: messages 비어있지 않음 + 마지막 role=user + 턴 상한 + resume 길이 상한. 위반 400.
- 공고 로드(JobService.byId 또는 기존 조회; 없음/비활성 404). 회사 intel(CompanyService). 프로필(ProfileService.load — 없으면 빈 요약). 키워드 갭(`ResumeOptimizer`).
- grounding 조립 → `AiClient.coachChat(...)`. ai 503/실패 시 503 전파("상담 기능 미설정/일시 오류").
- `CoachDtos`: `CoachRequest(job_id, resume, messages)`, `ChatMessage(role, content)`, `CoachReply(reply)`.
- SecurityConfig `/api/v1/me/**` 이미 `.authenticated()`(무변경).

**AiClient.coachChat** — 기존 ai 호출 메서드 패턴(summarize/parseProfile) 따라 `/internal/coach-chat` POST.

## 3. 웹 (Next.js)

- **`app/me/coach/page.tsx`**(server, `/me/*` 미들웨어 보호) → `CoachChat`.
- **`components/coach/CoachChat.tsx`**(client):
  - 공고 선택: `/api/me/saved` + `/api/me/recommend`(POST, note null) 합쳐 dedup → 목록서 1건 선택(제목·회사). 없으면 "저장/추천 공고가 없어요 → /search·/recommend" 안내.
  - 이력서 textarea(붙여넣기 + "저장되지 않아요" 안내).
  - 채팅: `messages` 세션 state, 입력창. 전송 → `POST /api/me/coach {job_id, resume, messages:[...history,{role:"user",content:input}]}` → reply를 `{role:"assistant"}`로 추가. 공고+이력서+입력 모두 있어야 전송 활성. 대기 중 "작성 중…", 에러 인라인. reply 마크다운 렌더(기존 마크다운 유틸 있으면 재사용, 없으면 줄바꿈 텍스트).
- **`app/api/me/coach/route.ts`**(인증 프록시, POST, getSessionToken 패턴, 타임아웃 ~30s, 502).
- `AccountMenu`에 "이력서 코치" `/me/coach` 링크.

## 재사용 / 경계

| 신규 | 재사용 |
|---|---|
| ai coach.py, CoachController/CoachDtos/AiClient.coachChat, /me/coach 페이지, CoachChat, 프록시, 계정메뉴 링크 | coach.ResumeOptimizer(키워드 갭), CompanyService(회사 intel), ProfileService, JobService(공고 로드), OpenAI summarize 패턴, RateLimiter, /me/saved·/recommend/me(공고 선택), 인증/세션/프록시 패턴 |

## 검증 계획

- 백엔드: CoachController grounding 조립·검증(빈 messages 400, 잘못된/비활성 공고 404, 마지막 비-user 400), ai 키 없음 503. ai coach.py는 OpenAI monkeypatch(`test_summarize_route` 패턴)로 메시지 구성·reply 파싱.
- 웹: Vitest CoachChat(공고+이력서+입력 전 전송 비활성, reply 추가, messages threading, 빈 공고 안내). typecheck/lint/build.
- 라이브(Playwright): /me/coach 저장 공고 선택 + 이력서 붙여넣기 + 멀티턴 대화 → JD/스킬 근거 답변·갭 정직, 키 없을 때 503 안내, 비회원 진입 차단.

## 스코프 제외(후속)

스트리밍 응답, 대화기록 영구저장, 이력서 파일 업로드/프로필 저장, 자동 이력서 리라이트(diff 적용), 면접 코치. 본격 벡터 RAG(여러 공고 교차 질의).
