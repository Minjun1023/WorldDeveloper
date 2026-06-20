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

SYSTEM = (
    "You are a resume coach for a Korean developer applying to overseas software jobs. "
    "Answer in Korean; keep tech terms/company names in English. "
    "Ground every suggestion ONLY in the provided context (the job posting if one is present, "
    "the user's resume, and the keyword-gap facts). "
    "NEVER invent experience, skills, or achievements the resume does not contain. "
    "If the context does NOT include a specific job posting, do NOT invent, guess, or imply any job's "
    "requirements or 'keywords for this role'. In that case give general resume/career feedback grounded "
    "only in the resume, and tell the user to attach a target job posting to get job-specific keywords. "
    "When a posting genuinely needs something the resume lacks, name it honestly as a gap and suggest how to "
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

    # 공고/이력서가 비어도 빈 섹션이 '공고 컨텍스트'로 오인되지 않게 명시 — #255 이후 셋 중 하나만 와도 됨.
    ctx = req.context.strip() or "(제공된 공고/추가 컨텍스트 없음)"
    resume_block = req.resume.strip() or "(제공된 이력서 없음)"
    openai_messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "system", "content": f"=== CONTEXT (job posting if any, plus facts) ===\n{ctx}\n\n=== RESUME ===\n{resume_block}"},
    ] + [{"role": m.role, "content": m.content} for m in msgs]

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                OPENAI_URL,
                headers={"Authorization": f"Bearer {key}", "content-type": "application/json"},
                json={"model": settings.openai_model, "max_tokens": 1024, "temperature": 0.3, "messages": openai_messages},
            )
        if resp.status_code != 200:
            log.warning("openai coach HTTP %s: %s", resp.status_code, resp.text[:300])
            raise HTTPException(502, f"coach upstream error ({resp.status_code})")
        reply = resp.json()["choices"][0]["message"]["content"] or ""
        return CoachReply(reply=reply, engine=settings.openai_model)
    except (httpx.HTTPError, KeyError, IndexError, ValueError, AttributeError) as e:
        log.warning("openai coach 실패: %s", e)
        raise HTTPException(502, f"coach request failed: {e}") from e
