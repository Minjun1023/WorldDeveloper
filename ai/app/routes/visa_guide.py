"""POST /internal/visa-guide — 회수 청크에만 근거한 한국 개발자 비자 가이드 단락 합성."""
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
    "You write a short Korean visa guide for a Korean software engineer applying to an overseas role. "
    "Answer in Korean; keep visa names/terms in English (e.g. H-1B, Blue Card, Skilled Worker). "
    "Ground EVERYTHING ONLY in the provided guide chunks. "
    "NEVER invent visa names, salary thresholds, processing times, or rules not present in the chunks. "
    "If the chunks lack a needed detail, say '공식 사이트에서 확인 필요' instead of guessing. "
    "Focus on: how a Korean developer actually gets sponsored to work in this country "
    "(which visa, what the employer must do, any Korea-specific note). "
    "Do NOT include source URLs or dates in your text — those are attached separately. "
    "Write 2-4 concise sentences or short bullets. No preamble, no disclaimer, no AI self-reference."
)


class VisaGuideRequest(BaseModel):
    country: str = Field("", max_length=8)
    visa_status: str = Field("", max_length=32)
    job_meta: dict = {}
    chunks: list[dict] = []


class VisaGuideReply(BaseModel):
    guide: str
    engine: str


@router.post("/visa-guide", response_model=VisaGuideReply)
async def visa_guide(req: VisaGuideRequest) -> VisaGuideReply:
    key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(503, "OPENAI_API_KEY not set — 비자 가이드 미설정")
    if not req.chunks:
        raise HTTPException(422, "no chunks to ground on")

    import json as _json
    user_payload = _json.dumps({
        "country": req.country,
        "visa_status": req.visa_status,
        "job_meta": req.job_meta,
        "guide_chunks": req.chunks,
    }, ensure_ascii=False)
    body = {
        "model": settings.openai_model,
        "temperature": 0.2,
        "max_tokens": 500,
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
            log.warning("openai visa-guide HTTP %s: %s", resp.status_code, resp.text[:300])
            raise HTTPException(502, f"visa-guide upstream error ({resp.status_code})")
        content = resp.json()["choices"][0]["message"]["content"] or ""
        return VisaGuideReply(guide=content.strip(), engine=settings.openai_model)
    except (httpx.HTTPError, KeyError, IndexError) as e:
        log.warning("openai visa-guide 실패: %s", e)
        raise HTTPException(502, f"visa-guide request failed: {e}") from e
