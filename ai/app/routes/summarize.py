"""POST /internal/summarize — 영문 공고 → 한국어 4섹션 요약 (gpt-4o-mini, JSON 모드)."""
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
MODEL = "gpt-4o-mini"

SYSTEM = (
    "You summarize a software engineering job posting into Korean for Korean developers. "
    "Keep technical terms, programming languages, frameworks, tool names, and company names in English. "
    "Summarize ONLY what the posting explicitly states — never invent information. "
    "Respond with ONLY a JSON object with exactly these keys, each an array of concise Korean bullet "
    "strings (3-6 items each, or [] if the posting lacks that info): "
    '"responsibilities" (주요 업무), "requirements" (자격 요건), '
    '"visa" (비자/스폰서십/이주 관련), "compensation" (연봉/복지).'
)


class SummarizeRequest(BaseModel):
    title: str = ""
    description: str = Field("", max_length=20_000)
    lang: str = "ko"


class SummarizeResponse(BaseModel):
    responsibilities: list[str] = []
    requirements: list[str] = []
    visa: list[str] = []
    compensation: list[str] = []
    engine: str


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(req: SummarizeRequest) -> SummarizeResponse:
    # 입력 검증 먼저 (키 유무와 무관하게 400)
    if not req.description.strip():
        raise HTTPException(400, "description 비어있음")
    key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(503, "OPENAI_API_KEY not set — 요약 기능 미설정")

    user = json.dumps({"title": req.title, "description": req.description}, ensure_ascii=False)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                OPENAI_URL,
                headers={"Authorization": f"Bearer {key}", "content-type": "application/json"},
                json={
                    "model": MODEL,
                    "max_tokens": 500,
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": SYSTEM},
                        {"role": "user", "content": user},
                    ],
                },
            )
        if resp.status_code != 200:
            log.warning("openai summarize HTTP %s: %s", resp.status_code, resp.text[:300])
            raise HTTPException(502, f"summarize upstream error ({resp.status_code})")
        obj = json.loads(resp.json()["choices"][0]["message"]["content"] or "{}")

        def arr(k: str) -> list[str]:
            v = obj.get(k)
            return [str(x) for x in v] if isinstance(v, list) else []

        return SummarizeResponse(
            responsibilities=arr("responsibilities"),
            requirements=arr("requirements"),
            visa=arr("visa"),
            compensation=arr("compensation"),
            engine=MODEL,
        )
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
        log.warning("openai summarize 실패: %s", e)
        raise HTTPException(502, f"summarize request failed: {e}") from e
