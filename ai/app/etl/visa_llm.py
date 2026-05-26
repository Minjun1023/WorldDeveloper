"""LLM(gpt-4o-mini) 비자 분류 — unclear 공고 전문을 읽어 분류. 키 없거나 실패 시 None."""
from __future__ import annotations

import json
import logging
import os

import httpx

from ..config import settings

log = logging.getLogger(__name__)

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4o-mini"
_VALID = {"sponsors", "no_sponsor", "unclear"}

SYSTEM = (
    "You classify whether a software engineering job posting offers VISA SPONSORSHIP or "
    "relocation for an international (non-local) candidate, based ONLY on the posting text. "
    'Respond with ONLY a JSON object: {"status": "sponsors"|"no_sponsor"|"unclear", '
    '"reason": "<short Korean phrase>"}. '
    '"sponsors": states or clearly implies it will sponsor a work visa, work permit, or relocation. '
    '"no_sponsor": requires existing work authorization, states no sponsorship, or citizens/residents only. '
    '"unclear": the posting does not mention visa, work authorization, or relocation at all. '
    "Do not infer from company or location — only the posting text."
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
        evidence = [f"AI: {reason}"] if isinstance(reason, str) and reason.strip() else ["AI 분류"]
        return status, evidence
    except (httpx.HTTPError, KeyError, IndexError, ValueError, AttributeError) as e:
        log.warning("visa LLM 실패: %s", e)
        return None
