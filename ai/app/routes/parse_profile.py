"""POST /internal/parse-profile — 자연어 → RecommendProfile.

규칙 우선(profile_parser), 부족할 때만 gpt-4o-mini 폴백(JSON 모드, max_tokens 200).
"""
from __future__ import annotations

import json
import logging
import os

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field, ValidationError

from ..config import settings
from ..profile_parser import ParsedProfile, parse_rules

log = logging.getLogger(__name__)
router = APIRouter()

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4o-mini"

# LLM 폴백 응답 위생 처리용 허용값 — SYSTEM 프롬프트가 약속한 enum 만 통과시켜
# 환각값(seniority:"god-tier", years:-5, salary:99999999 등)이 그대로 반환되는 것을 막는다.
_LLM_SENIORITY = {"junior", "mid", "senior"}
_LLM_REMOTE = {"remote"}
_MAX_YEARS = 60
_MAX_SALARY = 10_000_000


def _sanitize_llm(data: dict) -> dict:
    """LLM 이 돌려준 필드값을 약속된 범위/enum 으로 위생 처리(이탈값은 제거 → 기본값)."""
    if data.get("seniority") not in _LLM_SENIORITY:
        data.pop("seniority", None)
    if data.get("remote_preference") not in _LLM_REMOTE:
        data.pop("remote_preference", None)
    ye = data.get("years_experience")
    if not isinstance(ye, int) or isinstance(ye, bool) or not (0 <= ye <= _MAX_YEARS):
        data.pop("years_experience", None)
    sal = data.get("desired_salary_usd")
    if not isinstance(sal, int) or isinstance(sal, bool) or not (0 <= sal <= _MAX_SALARY):
        data.pop("desired_salary_usd", None)
    for lk in ("skills", "preferred_locations"):
        if lk in data:
            vals = data[lk] if isinstance(data[lk], list) else []
            data[lk] = [s for s in vals if isinstance(s, str) and s.strip()][:50]
    return data

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
        return ProfilePayload(**_sanitize_llm(data))
    except (httpx.HTTPError, KeyError, IndexError, ValueError, ValidationError) as e:
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
