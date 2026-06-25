"""POST /internal/application-kit — 공고+이력서+스킬갭으로 지원 키트 4종(JSON) 합성."""
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

SYSTEM = (
    "You are a job-application assistant for a Korean developer applying to overseas roles. "
    "Answer in Korean; keep tech terms/company names in English. "
    "Ground EVERYTHING only in the provided job posting, resume, and skill-gap facts. "
    "NEVER invent experience, skills, achievements, or numbers the resume does not contain; "
    "when a number is needed but absent, use a bracketed placeholder like [처리량 N건/일]. "
    "Return a SINGLE JSON object with exactly these keys: "
    "fit_summary (one or two sentences on how well this job fits the candidate), "
    "skill_strategy (how to cover the missing skills by reframing existing experience), "
    "cover_letter (a concise Korean cover-letter draft grounded in the resume and the role), "
    "interview_questions (array of 4-6 likely interview questions for THIS role/stack). "
    "Output JSON only, no prose around it."
)


class KitRequest(BaseModel):
    jd: str = Field("", max_length=8000)
    resume: str = Field("", max_length=20000)
    job_meta: dict = {}
    skill_gap: dict = {}


class KitReply(BaseModel):
    fit_summary: str
    skill_strategy: str
    cover_letter: str
    interview_questions: list[str]
    engine: str


def _parse_kit_json(raw: str) -> dict:
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as e:
        raise ValueError(f"kit JSON 파싱 실패: {e}") from e
    return {
        "fit_summary": str(data.get("fit_summary", "")),
        "skill_strategy": str(data.get("skill_strategy", "")),
        "cover_letter": str(data.get("cover_letter", "")),
        "interview_questions": [str(q) for q in (data.get("interview_questions") or [])],
    }


@router.post("/application-kit", response_model=KitReply)
async def application_kit(req: KitRequest) -> KitReply:
    key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(503, "OPENAI_API_KEY not set — 지원 키트 미설정")
    user_payload = json.dumps({
        "job_meta": req.job_meta,
        "skill_gap": req.skill_gap,
        "job_description": req.jd[:8000],
        "resume": req.resume[:20000] or "(이력서 없음)",
    }, ensure_ascii=False)
    body = {
        "model": settings.openai_model,
        "temperature": 0.3,
        "max_tokens": 1200,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user_payload},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=60) as c:
            resp = await c.post(OPENAI_URL, headers={"Authorization": f"Bearer {key}",
                                                     "content-type": "application/json"}, json=body)
        if resp.status_code != 200:
            log.warning("openai kit HTTP %s: %s", resp.status_code, resp.text[:300])
            raise HTTPException(502, f"kit upstream error ({resp.status_code})")
        content = resp.json()["choices"][0]["message"]["content"] or "{}"
        kit = _parse_kit_json(content)
        return KitReply(engine=settings.openai_model, **kit)
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
        log.warning("openai kit 실패: %s", e)
        raise HTTPException(502, f"kit request failed: {e}") from e
