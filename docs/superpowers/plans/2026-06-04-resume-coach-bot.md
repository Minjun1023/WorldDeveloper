# 대화형 이력서 상담봇 (/me/coach) Implementation Plan (기능 B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원이 선택한 공고에 맞춰 이력서를 상담받는 멀티턴 대화형 봇(/me/coach) — 단일 공고 JD+회사+키워드갭+프로필을 grounding으로 OpenAI gpt-4o-mini 호출.

**Architecture:** 대화기록은 클라이언트가 세션 보유(매 턴 전체 전송, 백엔드 무상태). 백엔드 `POST /api/v1/me/coach`가 grounding을 조립해 ai `/internal/coach-chat`(OpenAI) 호출. 벡터 RAG 아닌 직접 컨텍스트 주입. 회원 전용·정직 가드레일·키 없으면 503.

**Tech Stack:** FastAPI(ai, OpenAI httpx), Spring Boot(Java17), Next.js 14(TS, Vitest), 기존 ResumeOptimizer/CompanyService/JobService/ProfileService/AiClient 재사용.

명령: ai `cd ai && uv run ...`, backend `cd backend && ./gradlew ...`, web `cd web && npm run ...`.

---

## 파일 구조
- `ai/app/routes/coach.py` (신규) + `ai/app/main.py` 라우터 등록 + `ai/tests/test_coach_route.py`
- `backend/.../coach/dto/CoachDtos.java` (신규), `coach/CoachController.java` (신규), `strategist/AiClient.java`(coachChat 추가)
- `web/app/api/me/coach/route.ts`(신규), `web/components/coach/CoachChat.tsx`(+test), `web/app/me/coach/page.tsx`(신규), `web/components/auth/AccountMenu.tsx`(링크)

---

### Task 1: ai `/internal/coach-chat` 엔드포인트 (+테스트)

**Files:** Create `ai/app/routes/coach.py`, `ai/tests/test_coach_route.py`; Modify `ai/app/main.py`

- [ ] **Step 1: 실패하는 테스트** — `ai/tests/test_coach_route.py` (test_summarize_route.py 패턴: httpx.AsyncClient.post monkeypatch)

```python
"""Tests for /internal/coach-chat — monkeypatches httpx.AsyncClient.post."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def _mock_openai(reply: str) -> MagicMock:
    content = json.dumps({"choices": [{"message": {"content": reply}}]})
    m = MagicMock()
    m.status_code = 200
    m.json.return_value = json.loads(content)
    m.text = content
    return m


def test_no_key_returns_503(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    r = client.post("/internal/coach-chat", json={"context": "ctx", "resume": "r", "messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 503


def test_empty_messages_returns_400(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "k")
    r = client.post("/internal/coach-chat", json={"context": "ctx", "resume": "r", "messages": []})
    assert r.status_code == 400


def test_valid_returns_reply(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "k")
    mock_post = AsyncMock(return_value=_mock_openai("이력서의 Go 경험을 맨 위로 올리세요."))
    with patch("httpx.AsyncClient.post", mock_post):
        r = client.post("/internal/coach-chat", json={
            "context": "JD: Go backend. present=[go] missing=[kafka]",
            "resume": "Go developer 5y",
            "messages": [{"role": "user", "content": "이 공고에 맞게 어떻게 고칠까요?"}],
        })
    assert r.status_code == 200
    assert "Go" in r.json()["reply"]
    # 시스템 가드레일 + context + 사용자 메시지가 OpenAI 로 전달되었는지
    sent = mock_post.call_args.kwargs["json"]["messages"]
    assert sent[0]["role"] == "system"
    assert any(m["content"] == "이 공고에 맞게 어떻게 고칠까요?" for m in sent)
```

- [ ] **Step 2: 실패 확인** — Run: `cd ai && uv run --extra dev pytest tests/test_coach_route.py -v` → FAIL(엔드포인트 없음/404).

- [ ] **Step 3: 구현** — `ai/app/routes/coach.py`

```python
"""POST /internal/coach-chat — 이력서 상담 멀티턴 (gpt-4o-mini). 단일 공고 grounding 주입."""
from __future__ import annotations

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
    "You are a resume coach for a Korean developer applying to a specific overseas software job. "
    "Answer in Korean; keep tech terms/company names in English. "
    "Ground every suggestion ONLY in the provided job posting, the user's resume, and the keyword gap facts. "
    "NEVER invent experience, skills, or achievements the resume does not contain. "
    "Suggest how to reframe/highlight the candidate's REAL experience for this posting. "
    "When the posting needs something the resume genuinely lacks, say so honestly as a gap and suggest how to "
    "address it — do not fabricate it. Be concrete and concise."
)

_ALLOWED_ROLES = {"user", "assistant"}
_MAX_MESSAGES = 30


class ChatMessage(BaseModel):
    role: str
    content: str = Field("", max_length=8_000)


class CoachRequest(BaseModel):
    context: str = Field("", max_length=16_000)
    resume: str = Field("", max_length=20_000)
    messages: list[ChatMessage] = []


class CoachReply(BaseModel):
    reply: str
    engine: str


@router.post("/coach-chat", response_model=CoachReply)
async def coach_chat(req: CoachRequest) -> CoachReply:
    msgs = [m for m in req.messages if m.role in _ALLOWED_ROLES and m.content.strip()][-_MAX_MESSAGES:]
    if not msgs or msgs[-1].role != "user":
        raise HTTPException(400, "messages 비어있음 또는 마지막이 user 가 아님")
    key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(503, "OPENAI_API_KEY not set — 상담 기능 미설정")

    openai_messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "system", "content": f"=== JOB & RESUME CONTEXT ===\n{req.context}\n\n=== RESUME ===\n{req.resume}"},
    ] + [{"role": m.role, "content": m.content} for m in msgs]

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                OPENAI_URL,
                headers={"Authorization": f"Bearer {key}", "content-type": "application/json"},
                json={"model": MODEL, "max_tokens": 1024, "temperature": 0.3, "messages": openai_messages},
            )
        if resp.status_code != 200:
            log.warning("openai coach HTTP %s: %s", resp.status_code, resp.text[:300])
            raise HTTPException(502, f"coach upstream error ({resp.status_code})")
        reply = resp.json()["choices"][0]["message"]["content"] or ""
        return CoachReply(reply=reply, engine=MODEL)
    except (httpx.HTTPError, KeyError, IndexError, ValueError, AttributeError) as e:
        log.warning("openai coach 실패: %s", e)
        raise HTTPException(502, f"coach request failed: {e}") from e
```

- [ ] **Step 4: 라우터 등록** — `ai/app/main.py`: import 줄에 `coach` 추가(`from .routes import ..., coach`), `app.include_router(coach.router, prefix="/internal", tags=["internal"])` 추가(summarize 등록 라인 옆).

- [ ] **Step 5: 통과 확인** — Run: `cd ai && uv run --extra dev pytest tests/test_coach_route.py -v` → 3 PASS. 전체: `uv run --extra dev pytest -q` → 통과.

- [ ] **Step 6: Commit**
```bash
git add ai/app/routes/coach.py ai/tests/test_coach_route.py ai/app/main.py
git commit -m "feat(ai): /internal/coach-chat (resume coach, grounded, key-gated)"
```

---

### Task 2: 백엔드 CoachDtos + AiClient.coachChat

**Files:** Create `backend/.../coach/dto/CoachDtos.java`; Modify `backend/.../strategist/AiClient.java`

- [ ] **Step 1: DTO 작성** — `backend/src/main/java/com/devjobs/coach/dto/CoachDtos.java`
```java
package com.devjobs.coach.dto;

import java.util.List;

public class CoachDtos {
    public record ChatMessage(String role, String content) {}
    public record CoachRequest(String job_id, String resume, List<ChatMessage> messages) {}
    public record CoachReply(String reply) {}
}
```

- [ ] **Step 2: AiClient 확인** — `backend/.../strategist/AiClient.java` 의 `summarize(...)` 구현(HTTP 클라이언트 idiom: `.uri(URI.create(baseUrl + "/internal/summarize"))` + body/응답 매핑)을 읽는다. 그 idiom을 그대로 따라 `coachChat` 추가.

- [ ] **Step 3: coachChat 추가** — `AiClient.java` 에 추가(summarize 와 동일한 HTTP 호출 방식 사용; 아래는 형태 — 실제 클라이언트 호출부는 summarize 의 것을 미러):
```java
    /** AI /internal/coach-chat 호출. ai 가 OpenAI 로 grounding+대화 전달. */
    public record CoachChatMessage(String role, String content) {}
    public record CoachChatResult(String reply, String engine) {}

    public CoachChatResult coachChat(String context, String resume, java.util.List<CoachChatMessage> messages) {
        var body = java.util.Map.of("context", context, "resume", resume, "messages", messages);
        // summarize 와 동일한 클라이언트/직렬화/에러 처리 idiom으로 baseUrl + "/internal/coach-chat" POST.
        // 응답 JSON { reply, engine } → CoachChatResult 로 매핑. ai 503/502 는 그대로 예외 전파(상위에서 503 처리).
        return /* summarize 패턴대로 구현 */ null;
    }
```
   (구현 시 summarize 메서드를 복붙해 URL/요청바디/응답타입만 바꾼다. 절대 새 HTTP 스택 도입하지 말 것 — 기존 idiom 재사용.)

- [ ] **Step 4: 빌드** — `cd backend && ./gradlew compileJava --no-daemon` → SUCCESSFUL.
- [ ] **Step 5: Commit**
```bash
git add backend/src/main/java/com/devjobs/coach/dto/CoachDtos.java backend/src/main/java/com/devjobs/strategist/AiClient.java
git commit -m "feat(be): CoachDtos + AiClient.coachChat"
```

---

### Task 3: 백엔드 CoachController (grounding 조립 + 검증)

**Files:** Create `backend/.../coach/CoachController.java`; Test `backend/.../coach/CoachControllerTest.java`

기존 키워드 최적화기는 `com.devjobs.coach` 패키지에 있다(같은 패키지). CompanyService.detail(slug), JobService.findById(id)→Optional<JobDetailDto>, ProfileService.load(uuid) 재사용.

- [ ] **Step 1: 기존 결합 확인** — 다음을 읽어 실제 시그니처/접근법을 확인:
  - `coach/ResumeOptimizer.java` 의 진입 메서드(예 `optimize(resume, jobDescription)`) 반환형(present/missing 포함) + 그게 어떻게 호출되는지(기존 `/api/resume-optimize` 백엔드 핸들러/서비스). 같은 패키지이므로 직접 사용 가능.
  - `JobService.findById(String)` 반환 `JobDetailDto` 의 description/title/company 접근자.
  - `CompanyService.detail(String slug)` 반환 `CompanyDetail` 접근자(intel 텍스트/태그).
  - `ProfileService.load(UUID)` 반환(없으면 empty).
  보고: 각 실제 시그니처.

- [ ] **Step 2: 실패하는 테스트** — `CoachControllerTest.java` (MockMvc + @WebMvcTest 또는 기존 컨트롤러 테스트 패턴; 협력자 @MockBean). 핵심 검증: 빈 messages→400, 잘못된/비활성 공고→404, ai 키없음(AiClient가 503 유발)→503, 정상→reply. (기존 백엔드 컨트롤러 테스트 패턴을 따른다.)
```java
package com.devjobs.coach;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
// ... 기존 컨트롤러 테스트와 동일한 @WebMvcTest/@MockBean 임포트

// @WebMvcTest(CoachController.class) + @MockBean(JobService/CompanyService/ProfileService/AiClient/RateLimiter)
class CoachControllerTest {
    // 인증 principal 주입은 기존 컨트롤러 테스트의 @WithMockUser/SecurityContext 패턴을 따른다.

    @Test
    void emptyMessagesReturns400() throws Exception {
        // POST /api/v1/me/coach with messages=[] → 400
    }

    @Test
    void unknownJobReturns404() throws Exception {
        // JobService.findById -> empty → 404
    }
}
```
   (테스트 보일러플레이트는 프로젝트의 기존 컨트롤러 테스트 1개를 열어 동일 구조로 작성. 최소 빈messages→400, 없는공고→404 두 케이스.)

- [ ] **Step 3: 실패 확인** — Run: `cd backend && ./gradlew test --no-daemon --tests "com.devjobs.coach.CoachControllerTest"` → FAIL.

- [ ] **Step 4: 구현** — `backend/src/main/java/com/devjobs/coach/CoachController.java`
```java
package com.devjobs.coach;

import com.devjobs.coach.dto.CoachDtos.CoachReply;
import com.devjobs.coach.dto.CoachDtos.CoachRequest;
import com.devjobs.company.CompanyService;
import com.devjobs.profile.ProfileService;
import com.devjobs.scout.JobService;
import com.devjobs.strategist.AiClient;
import com.devjobs.strategist.RateLimiter;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/v1/me/coach")
public class CoachController {

    private static final int MAX_RESUME = 20_000;

    private final JobService jobService;
    private final CompanyService companyService;
    private final ProfileService profileService;
    private final AiClient aiClient;
    private final RateLimiter rateLimiter;
    // 같은 패키지의 키워드 최적화기(기존). 주입 방식은 기존 resume-optimize 핸들러와 동일하게.
    private final ResumeOptimizer resumeOptimizer; // 또는 기존 호출 방식(서비스/정적)에 맞춤

    public CoachController(JobService jobService, CompanyService companyService, ProfileService profileService,
                           AiClient aiClient, RateLimiter rateLimiter, ResumeOptimizer resumeOptimizer) {
        this.jobService = jobService; this.companyService = companyService; this.profileService = profileService;
        this.aiClient = aiClient; this.rateLimiter = rateLimiter; this.resumeOptimizer = resumeOptimizer;
    }

    @PostMapping
    public ResponseEntity<CoachReply> coach(@AuthenticationPrincipal String userId, @RequestBody CoachRequest req) {
        if (req.messages() == null || req.messages().isEmpty()
                || !"user".equals(req.messages().get(req.messages().size() - 1).role())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "messages 비어있음/마지막 user 아님");
        }
        if (req.resume() != null && req.resume().length() > MAX_RESUME) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "resume 너무 김");
        }
        if (!rateLimiter.tryAcquire("chat:" + userId)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "요청이 많아요. 잠시 후 다시.");
        }
        var jobOpt = jobService.findById(req.job_id());
        if (jobOpt.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "공고 없음");
        var job = jobOpt.get();

        String context = buildContext(job, req.resume(), UUID.fromString(userId));
        var aiMsgs = req.messages().stream()
            .map(m -> new AiClient.CoachChatMessage(m.role(), m.content())).toList();
        try {
            var result = aiClient.coachChat(context, req.resume() == null ? "" : req.resume(), aiMsgs);
            return ResponseEntity.ok(new CoachReply(result.reply()));
        } catch (Exception e) {
            // ai 503(키없음)/502 → 503 으로 전파
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "상담 기능을 사용할 수 없어요.");
        }
    }

    private String buildContext(/* JobDetailDto */ Object job, String resume, UUID userId) {
        // 1) JD: job.title + job.description(앞 ~3500자) + 위치/비자
        // 2) 회사: companyService.detail(job.company.slug) 의 intel 요약(있으면)
        // 3) 키워드 갭: resumeOptimizer.optimize(resume, jobDescription) 의 present/missing
        // 4) 프로필: profileService.load(userId) 요약(skills/seniority/locations; 없으면 생략)
        // 위를 사람이 읽는 라벨된 문자열로 합쳐 반환. (실제 접근자명은 Step 1 확인값 사용)
        return /* 조립 문자열 */ "";
    }
}
```
   **buildContext 는 Step 1 에서 확인한 실제 접근자(JobDetailDto.description()/title()/company(), CompanyDetail, ResumeOptimizer 반환의 present()/missing(), ProfileService 반환 필드)로 채운다.** JD 는 3500자 truncate. 키워드 갭은 "보유 스킬: ... / 공고 요구 중 미보유: ..." 형식. 프로필 없으면 그 줄 생략.

- [ ] **Step 5: 통과 확인** — `cd backend && ./gradlew test --no-daemon --tests "com.devjobs.coach.CoachControllerTest"` → PASS. 그리고 `./gradlew build --no-daemon` → SUCCESSFUL.
- [ ] **Step 6: Commit**
```bash
git add backend/src/main/java/com/devjobs/coach/CoachController.java backend/src/test/java/com/devjobs/coach/CoachControllerTest.java
git commit -m "feat(be): CoachController (grounding assembly + validation + ai call)"
```

---

### Task 4: 웹 인증 프록시 `/api/me/coach`

**Files:** Create `web/app/api/me/coach/route.ts`

- [ ] **Step 1: 작성** — `web/app/api/me/coach/route.ts` (기존 `/api/me/recommend` 패턴):
```ts
import { NextResponse } from "next/server";

import { getSessionToken } from "@/lib/session-server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function POST(req: Request) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/me/coach`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: await req.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(40_000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "상담 서버에 연결할 수 없어요." }, { status: 502 });
  }
}
```
- [ ] **Step 2: typecheck/lint** → 통과. (web node_modules 없으면 `npm ci` 먼저.)
- [ ] **Step 3: Commit**
```bash
git add web/app/api/me/coach/route.ts
git commit -m "feat(web): /api/me/coach auth proxy"
```

---

### Task 5: CoachChat 컴포넌트 (+Vitest)

**Files:** Create `web/components/coach/CoachChat.tsx`, `web/components/coach/CoachChat.test.tsx`

- [ ] **Step 1: 실패하는 테스트** — `web/components/coach/CoachChat.test.tsx`
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CoachChat } from "@/components/coach/CoachChat";

const jobs = [{ id: "greenhouse:acme:1", title: "Backend Engineer", company: { slug: "acme", display_name: "Acme" } }];

describe("CoachChat", () => {
  it("disables send until job + resume + input all present", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    const send = screen.getByRole("button", { name: /보내기/ });
    expect(send).toBeDisabled();                       // 아무것도 없음
    await user.selectOptions(screen.getByRole("combobox"), "greenhouse:acme:1");
    await user.type(screen.getByPlaceholderText(/이력서/), "Go dev 5y");
    await user.type(screen.getByPlaceholderText(/질문/), "어떻게 고칠까요?");
    expect(send).toBeEnabled();
  });

  it("posts and appends assistant reply", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reply: "Go 경험을 위로 올리세요." }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole("combobox"), "greenhouse:acme:1");
    await user.type(screen.getByPlaceholderText(/이력서/), "Go dev 5y");
    await user.type(screen.getByPlaceholderText(/질문/), "어떻게?");
    await user.click(screen.getByRole("button", { name: /보내기/ }));
    expect(await screen.findByText("Go 경험을 위로 올리세요.")).toBeInTheDocument();
    const body = JSON.parse(fetchMock.mock.calls.at(-1)[1].body);
    expect(body.job_id).toBe("greenhouse:acme:1");
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "어떻게?" });
  });
});
```

- [ ] **Step 2: 실패 확인** — `cd web && npm run test -- components/coach/CoachChat.test.tsx` → FAIL.

- [ ] **Step 3: 구현** — `web/components/coach/CoachChat.tsx`
```tsx
"use client";

import { useState } from "react";

type PickJob = { id: string; title: string; company: { display_name: string } };
type Msg = { role: "user" | "assistant"; content: string };

export function CoachChat({ initialJobs }: { initialJobs: PickJob[] }) {
  const [jobId, setJobId] = useState("");
  const [resume, setResume] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = !!jobId && resume.trim().length > 0 && input.trim().length > 0 && !pending;

  async function send() {
    if (!canSend) return;
    const next: Msg[] = [...messages, { role: "user", content: input.trim() }];
    setMessages(next);
    setInput("");
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/me/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id: jobId, resume, messages: next }),
      });
      if (res.status === 503) throw new Error("상담 기능이 아직 설정되지 않았어요.");
      if (!res.ok) throw new Error(`오류 (HTTP ${res.status})`);
      const data = (await res.json()) as { reply: string };
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  if (initialJobs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center text-body-sm text-muted-foreground">
        상담할 공고가 없어요. 먼저 공고를 저장하거나 맞춤 추천을 받아보세요.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-body-sm font-medium">상담할 공고</span>
          <select value={jobId} onChange={(e) => setJobId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-body-sm">
            <option value="">공고 선택…</option>
            {initialJobs.map((j) => <option key={j.id} value={j.id}>{j.title} · {j.company.display_name}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-body-sm font-medium">이력서 (저장되지 않아요)</span>
          <textarea value={resume} onChange={(e) => setResume(e.target.value)} rows={3}
            placeholder="이력서 전문을 붙여넣으세요"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm" />
        </label>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-surface p-4 min-h-[160px]">
        {messages.length === 0 && <p className="text-body-sm text-muted-foreground">공고와 이력서를 넣고, 이 공고에 맞춰 이력서를 어떻게 고칠지 물어보세요.</p>}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <span className={"inline-block whitespace-pre-wrap rounded-lg px-3 py-2 text-body-sm " + (m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {m.content}
            </span>
          </div>
        ))}
        {pending && <p className="text-body-sm text-muted-foreground">작성 중…</p>}
        {error && <p className="text-body-sm text-destructive">{error}</p>}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="질문 입력…"
          className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 text-body-sm" />
        <button type="submit" disabled={!canSend}
          className="rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground disabled:opacity-50">
          보내기
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: 통과 확인** — `cd web && npm run test -- components/coach/CoachChat.test.tsx` → 2 PASS. typecheck 통과.
- [ ] **Step 5: Commit**
```bash
git add web/components/coach/CoachChat.tsx web/components/coach/CoachChat.test.tsx
git commit -m "feat(web): CoachChat multi-turn component + tests"
```

---

### Task 6: /me/coach 페이지 + 계정메뉴 링크

**Files:** Create `web/app/me/coach/page.tsx`; Modify `web/components/auth/AccountMenu.tsx`

- [ ] **Step 1: 페이지(server)** — `web/app/me/coach/page.tsx`. 저장/추천 공고를 서버에서 받아 `initialJobs` 로 전달(클라가 또 fetch해도 되지만 서버 prefetch가 간단). 인증 토큰으로 백엔드 호출:
```tsx
import { CoachChat } from "@/components/coach/CoachChat";
import { getSessionToken } from "@/lib/session-server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

type PickJob = { id: string; title: string; company: { display_name: string } };

async function fetchPickJobs(token: string): Promise<PickJob[]> {
  const seen = new Map<string, PickJob>();
  try {
    const saved = await fetch(`${BACKEND_URL}/api/v1/me/saved`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (saved.ok) for (const j of (await saved.json()) as PickJob[]) seen.set(j.id, j);
  } catch { /* 무시 */ }
  try {
    const rec = await fetch(`${BACKEND_URL}/api/v1/recommend/me`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ note: null }), cache: "no-store",
    });
    if (rec.ok) {
      const data = (await rec.json()) as { recommendations: { job: PickJob }[] };
      for (const r of data.recommendations ?? []) if (!seen.has(r.job.id)) seen.set(r.job.id, r.job);
    }
  } catch { /* 무시 */ }
  return [...seen.values()];
}

export default async function CoachPage() {
  const token = await getSessionToken();
  const jobs = token ? await fetchPickJobs(token) : [];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section>
        <h1 className="text-display">이력서 코치</h1>
        <p className="mt-2 text-muted-foreground">저장하거나 추천받은 공고에 맞춰 이력서를 어떻게 고칠지 상담해드려요. (이력서는 저장되지 않아요)</p>
      </section>
      <CoachChat initialJobs={jobs} />
    </div>
  );
}
```
   (주의: `JobDto`/recommend 응답의 실제 필드명(`company.display_name` 등)에 맞춘다. `/me/*` 는 미들웨어 보호.)

- [ ] **Step 2: 계정메뉴 링크** — `AccountMenu.tsx` 의 "저장한 공고"(`/me/saved`) 링크 옆에 동일 className 으로 "이력서 코치" `/me/coach` 추가.

- [ ] **Step 3: typecheck/lint/build** → 통과.
- [ ] **Step 4: Commit**
```bash
git add web/app/me/coach web/components/auth/AccountMenu.tsx
git commit -m "feat(web): /me/coach page (job picker prefetch) + account menu link"
```

---

### Task 7: 라이브 통합 검증 + 최종 게이트

**Files:** 없음(검증).

- [ ] **Step 1: 스택 기동** — worktree backend 8090 / web 3100 / 공유 postgres 5433([[worktree-devsh-compose-conflict]]). `OPENAI_API_KEY` 설정(상담은 LLM 필요 — 루트 .env 또는 env). 미설정이면 503 경로만 검증.
- [ ] **Step 2: 비회원/무공고** — 비회원 `/me/coach` 차단(미들웨어). 저장·추천 공고 없으면 "상담할 공고가 없어요" 안내.
- [ ] **Step 3: 정상 흐름** — 검증 계정(프로필+저장공고)으로 `/me/coach`: 공고 선택 + 이력서 붙여넣기 + 질문 → reply 표시. 멀티턴(후속 질문) 동작. 답변이 JD/이력서 근거인지·없는 경험 날조 안 하는지 눈검증.
- [ ] **Step 4: 키 없음** — `OPENAI_API_KEY` 비우고 전송 → 503 안내("상담 기능이 아직 설정되지 않았어요").
- [ ] **Step 5: 레이트리밋** — chat:userId 한도 초과 시 429(또는 상위 503 처리) 확인.
- [ ] **Step 6: 최종 게이트** — `cd ai && uv run --extra dev pytest -q` · `cd backend && ./gradlew build --no-daemon` · `cd web && npm run test && npm run typecheck && npm run lint && npm run build` 모두 통과.

---

## Self-Review 결과

**Spec coverage:**
- 멀티턴 세션 채팅(클라 기록, 무상태 백엔드) → 계약 Task1·3, CoachChat Task5 ✅
- 단일 공고 grounding(JD+회사+키워드갭+프로필) → CoachController.buildContext Task3 ✅
- 이력서 붙여넣기(저장 안 함) → CoachChat resume state, 백엔드 미저장 ✅
- /me/coach + 공고 선택(저장/추천) → Task6 prefetch + Task5 picker ✅
- OpenAI gpt-4o-mini + 정직 가드레일 + 키 503 → Task1(SYSTEM, 503) ✅
- 레이트리밋(chat:userId) → Task3 ✅
- 비스트리밍, 회원 전용(/me/** 게이트) → Task5/Task3 ✅
- 검증(ai/backend 단위 + 라이브) → Task1·3 + Task7 ✅

**Placeholder scan:** Task2 AiClient.coachChat 와 Task3 buildContext 는 "기존 summarize HTTP idiom 복붙" / "Step1 확인 접근자로 조립"이라는 **실제값-확인 지시**(추측 코드 방지) — member-profile/landing 플랜과 동일 방식. 그 외 코드 스텝은 실제 코드.

**Type consistency:**
- `CoachRequest(job_id, resume, messages[{role,content}])` ↔ ai CoachRequest(context/resume/messages) — 백엔드가 job_id로 context 조립 후 ai 호출, 계약 분리 일관 ✅
- `CoachReply(reply)` 백엔드 ↔ ai `{reply, engine}` (백엔드는 reply만 추출) ✅
- 웹 CoachChat POST body `{job_id, resume, messages}` ↔ 백엔드 CoachRequest ✅
- `AiClient.CoachChatMessage(role,content)`/`CoachChatResult(reply,engine)` — Task2 정의, Task3 사용 일치 ✅
- `/api/me/coach`(웹 프록시 Task4) ↔ CoachChat 호출(Task5) ↔ 백엔드 `/api/v1/me/coach`(Task3) 경로 일관 ✅
