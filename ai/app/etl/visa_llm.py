"""LLM(gpt-4o-mini) 비자 분류 — unclear 공고 전문을 읽어 분류. 키 없거나 실패 시 None."""
from __future__ import annotations

import json
import logging
import os
import re

import httpx

from ..config import settings

log = logging.getLogger(__name__)

OPENAI_URL = "https://api.openai.com/v1/chat/completions"


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower()


def _quote_in_text(quote: str, text: str) -> bool:
    """LLM 이 인용한 근거 문구가 공고 원문에 실제로 있는지(공백/대소문자 무시)."""
    q = _norm(quote)
    return len(q) >= 6 and q in _norm(text)


# 인용 근거가 실제로 비자/취업허가/이주에 관한 것인지 확인하는 관련성 키워드(다국어, 부분일치)
_VISA_RELEVANT = (
    "visa", "visum", "sponsor", "work authoriz", "work authoris", "work permit",
    "authorized to work", "authorised to work", "authorization to work", "right to work",
    "eligible to work", "citizen", "permanent resident", "green card", "relocat",
    "immigration", "immigrant", "blue card", "blaue karte", "arbeitserlaubnis",
    "arbeitsvisum", "aufenthalt", "umzug", "visumsponsoring", "werkvergunning",
    "kennismigrant", "就労", "在留", "永住", "ビザ", "リロケーション",
)


def _visa_relevant(quote: str) -> bool:
    q = _norm(quote)
    return any(tok in q for tok in _VISA_RELEVANT)


MODEL = "gpt-4o-mini"
_VALID = {"sponsors", "no_sponsor", "unclear"}

SYSTEM = (
    "You decide a software job posting's VISA SPONSORSHIP status for an international (non-local) "
    "candidate, using ONLY explicit statements in the posting text. "
    'Respond with ONLY a JSON object: {"status": "sponsors"|"no_sponsor"|"unclear", "reason": "<verbatim quote>"}. '
    'DEFAULT to "unclear". '
    "Choose sponsors or no_sponsor ONLY if the posting contains an explicit phrase about visa, work permit, work "
    'authorization, sponsorship, or relocation. In that case set "reason" to the EXACT phrase copied VERBATIM from '
    "the posting (in its original language, max ~15 words) that proves it — do NOT paraphrase or translate. "
    '"sponsors": the quoted phrase explicitly offers visa/work-permit sponsorship OR relocation assistance. '
    '"no_sponsor": the quoted phrase explicitly requires existing work authorization / right to work, says it does '
    "NOT sponsor, or restricts to citizens/permanent residents. "
    'If you cannot copy such an explicit phrase verbatim, you MUST return {"status": "unclear", "reason": ""}. '
    "CRITICAL: Remote work, 'work from anywhere', distributed/global team, or hiring across countries is NOT visa "
    "sponsorship. Do NOT infer from company, country, location, or the ABSENCE of a statement."
)


async def classify_visa_llm(title: str, description: str) -> tuple[str, list[str]] | None:
    key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not key or not (description or "").strip():
        return None
    user = json.dumps({"title": title or "", "description": description[:12000]}, ensure_ascii=False)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
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
                        {"role": "user", "content": user},
                    ],
                },
            )
        if resp.status_code != 200:
            log.warning("visa LLM HTTP %s: %s", resp.status_code, resp.text[:200])
            return None
        obj = json.loads(resp.json()["choices"][0]["message"]["content"] or "{}")
        status = obj.get("status")
        if status not in _VALID:
            return None
        reason = obj.get("reason")
        reason = reason if isinstance(reason, str) else ""
        # 근거 검증: sponsors/no_sponsor 는 인용문이 공고 원문에 실제 있어야 하고(grounding),
        # 비자/취업허가/이주 관련 키워드도 포함해야 인정(relevance). 둘 중 하나라도 실패 시 unclear.
        if status in ("sponsors", "no_sponsor") and not (
            _quote_in_text(reason, description) and _visa_relevant(reason)
        ):
            return "unclear", []
        evidence = [f"AI: {reason}"] if reason.strip() else ["AI 분류"]
        return status, evidence
    except (httpx.HTTPError, KeyError, IndexError, ValueError, AttributeError) as e:
        log.warning("visa LLM 실패: %s", e)
        return None
