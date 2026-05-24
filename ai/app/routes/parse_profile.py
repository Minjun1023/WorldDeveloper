"""POST /internal/parse-profile — 자연어 → RecommendProfile.

규칙 우선(profile_parser), 부족할 때만 gpt-4o-mini 폴백(JSON 모드, max_tokens 200).
"""
from __future__ import annotations

import json
import logging
import os

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..config import settings
from ..profile_parser import ParsedProfile, parse_rules

log = logging.getLogger(__name__)
router = APIRouter()

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4o-mini"

SYSTEM = (
    "Extract a developer job-search profile from a short Korean/English sentence. "
    'Respond with ONLY JSON with keys: skills (string[]), '
    'seniority ("junior"|"mid"|"senior"|null), years_experience (int|null), '
    "needs_visa_sponsorship (bool|null), preferred_locations (string[], English city/country), "
    'remote_preference ("remote"|null), desired_salary_usd (int|null). Keep tech names in English.'
)


class ParseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=200)
    lang: str = "ko"


class ProfilePayload(BaseModel):
    skills: list[str] = []
    seniority: str | None = None
    years_experience: int | None = None
    needs_visa_sponsorship: bool | None = None
    preferred_locations: list[str] = []
    remote_preference: str | None = None
    desired_salary_usd: int | None = None


class ParseResponse(BaseModel):
    profile: ProfilePayload
    source: str
    sufficient: bool


def _to_payload(p: ParsedProfile) -> ProfilePayload:
    return ProfilePayload(
        skills=p.skills,
        seniority=p.seniority,
        years_experience=p.years_experience,
        needs_visa_sponsorship=p.needs_visa_sponsorship,
        preferred_locations=p.preferred_locations,
        remote_preference=p.remote_preference,
        desired_salary_usd=p.desired_salary_usd,
    )


async def _llm_fallback(text: str) -> ProfilePayload | None:
    key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        return None
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                OPENAI_URL,
                headers={"Authorization": f"Bearer {key}", "content-type": "application/json"},
                json={
                    "model": MODEL,
                    "max_tokens": 200,
                    "temperature": 0.0,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": SYSTEM},
                        {"role": "user", "content": text},
                    ],
                },
            )
        if resp.status_code != 200:
            log.warning("parse llm HTTP %s: %s", resp.status_code, resp.text[:200])
            return None
        obj = json.loads(resp.json()["choices"][0]["message"]["content"] or "{}")
        data = {k: obj[k] for k in ProfilePayload.model_fields if k in obj and obj[k] is not None}
        return ProfilePayload(**data)
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
        log.warning("parse llm 실패: %s", e)
        return None


@router.post("/parse-profile", response_model=ParseResponse)
async def parse_profile(req: ParseRequest) -> ParseResponse:
    rules = parse_rules(req.text)
    if rules.sufficient:
        return ParseResponse(profile=_to_payload(rules), source="rules", sufficient=True)
    llm = await _llm_fallback(req.text)
    if llm is not None:
        suff = bool(llm.skills or llm.preferred_locations or llm.seniority)
        return ParseResponse(profile=llm, source="llm", sufficient=suff)
    return ParseResponse(profile=_to_payload(rules), source="rules", sufficient=False)
