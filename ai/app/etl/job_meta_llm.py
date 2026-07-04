"""공고 본문 LLM 메타 추출 — relocation 지원 / 어학 요건 / 학위 요건.

visa_llm 과 동일한 정직성 규칙: 모델이 인용한 근거 문구(quote)가 원문에 실제로
존재(verbatim)해야만 값으로 인정하고, 아니면 unclear 로 강등한다.
비용: gpt-4o-mini, 본문 12k자 절단, 응답 300토큰 이하 — 건당 ~$0.0003.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re

import httpx

from ..config import settings
from .visa_llm import _MAX_RETRIES, _RETRYABLE, _retry_after_seconds

log = logging.getLogger(__name__)

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

_RELO = {"yes", "no", "unclear"}
_DEGREE = {"required", "not_required", "unclear"}


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower()


def _quote_in_text(quote: str, text: str) -> bool:
    q = _norm(quote)
    return len(q) >= 6 and q in _norm(text)


SYSTEM = (
    "You extract three facts from a software job posting, for an international candidate deciding "
    "whether to apply. Use ONLY explicit statements in the posting text. Respond with ONLY a JSON object:\n"
    '{"relocation": "yes"|"no"|"unclear", "relocation_quote": "<verbatim>",\n'
    ' "language": "<language name>"|"english_only"|"unclear", "language_quote": "<verbatim>",\n'
    ' "degree": "required"|"not_required"|"unclear", "degree_quote": "<verbatim>"}\n'
    "DEFAULT every field to unclear. If the posting simply does not mention a topic, it is unclear — "
    "NEVER infer from the posting's language, location, remote policy, or company description.\n"
    "Rules:\n"
    "- relocation: yes ONLY if the quote explicitly offers relocation assistance/package/bonus/support. "
    "no ONLY if the quote explicitly denies relocation support. A location/onsite/remote requirement is NOT "
    "a statement about relocation.\n"
    "- language: a specific non-English language ONLY if the quote explicitly REQUIRES it (e.g. 'German B2', "
    "'business-level Japanese') — return the language name in English (\"German\", \"Japanese\"). "
    "english_only ONLY if the quote explicitly states English is the (only) working language or that no local "
    "language is needed. The posting merely being written in English is NOT english_only. "
    "'Nice to have'/'is a plus' languages do NOT count.\n"
    "- degree: required ONLY if the quote explicitly makes a university degree mandatory with no alternative. "
    "not_required ONLY if the quote explicitly says degree not required OR 'or equivalent experience' style "
    "alternative. A quote that merely lists experience requirements says NOTHING about degree → unclear.\n"
    "- Every non-unclear value MUST have its quote copied VERBATIM from the posting (original language, "
    "max ~15 words), and the quote itself must be ABOUT that topic. If you cannot quote such a sentence, "
    "return unclear with empty quote. Do NOT paraphrase or translate."
)

# 필드별 관련성 키워드 — 인용문이 실제 그 주제에 관한 문장인지 검증(visa_llm 의 _visa_relevant 와 동일 취지).
# 모델이 verbatim 인용은 지키면서 '무관한 문장'을 근거로 대는 환각을 걸러낸다.
_RELO_RELEVANT = ("relocat", "moving", "move to", "umzug", "引っ越", "移住", "이주", "리로케이션")
_LANG_RELEVANT = (
    "english", "german", "japanese", "french", "dutch", "korean", "spanish", "portuguese",
    "language", "fluent", "fluency", "proficien", "business level", "native", "bilingual",
    "b1", "b2", "c1", "c2", "日本語", "英語", "ドイツ語", "언어", "영어",
)
_DEGREE_RELEVANT = (
    "degree", "bachelor", "master", "phd", "bs", "ms", "b.s", "m.s", "diploma",
    "university", "equivalent experience", "equivalent practical", "educational background",
    "学位", "卒業", "학사", "석사", "학위",
)


def _relevant(quote: str, keywords: tuple[str, ...]) -> bool:
    q = _norm(quote)
    return any(k in q for k in keywords)


# "지원자가 이주할 수 있어야 한다"(요구)를 "회사가 이주를 지원한다"(혜택)로 오인하는 패턴.
_RELO_REQUIREMENT = re.compile(
    r"(available|willing(ness)?|ability|able|open|must|required?)\s+to\s+relocate", re.I)

# 학위 인용문에 '동등 경력 대체' 문구가 있으면 필수 학위가 아니다 — 모델이 자주 required 로 오분류.
_DEGREE_EQUIVALENT = re.compile(r"equivalent\s+(work\s+|practical\s+|relevant\s+)?experience", re.I)


async def extract_job_meta(title: str, description: str,
                           client: httpx.AsyncClient | None = None) -> dict | None:
    """공고 1건 추출. 실패/키 미설정 시 None. 반환 dict 는 검증(quote in text) 통과값만 담는다."""
    key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not key or not (description or "").strip():
        return None
    user = json.dumps({"title": title or "", "description": description[:12000]}, ensure_ascii=False)
    payload = {
        "model": MODEL,
        "max_tokens": 300,
        "temperature": 0.0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
    }
    headers = {"Authorization": f"Bearer {key}", "content-type": "application/json"}
    own_client = client is None
    if own_client:
        client = httpx.AsyncClient(timeout=60)
    try:
        resp = None
        for attempt in range(_MAX_RETRIES + 1):
            resp = await client.post(OPENAI_URL, headers=headers, json=payload)
            if resp.status_code == 200:
                break
            if resp.status_code in _RETRYABLE and attempt < _MAX_RETRIES:
                await asyncio.sleep(_retry_after_seconds(resp, attempt))
                continue
            log.warning("job meta LLM HTTP %s: %s", resp.status_code, resp.text[:200])
            return None
        if resp is None or resp.status_code != 200:
            return None
        obj = json.loads(resp.json()["choices"][0]["message"]["content"] or "{}")
    except Exception as e:  # noqa: BLE001 — 배치가 계속 돌도록 개별 실패는 None
        log.warning("job meta LLM 실패: %s", e)
        return None
    finally:
        if own_client:
            await client.aclose()

    return _validate(obj, description)


def _validate(obj: dict, text: str) -> dict:
    """스키마 강제 + 근거 인용 verbatim·관련성 검증 — 불충족 값은 unclear 로 강등."""
    relo = obj.get("relocation")
    relo_q = str(obj.get("relocation_quote") or "")
    if relo not in _RELO or (relo != "unclear"
                             and not (_quote_in_text(relo_q, text) and _relevant(relo_q, _RELO_RELEVANT))):
        relo, relo_q = "unclear", ""
    # "available/willing to relocate" 는 지원자 요구사항이지 회사의 이주 지원이 아님.
    if relo == "yes" and _RELO_REQUIREMENT.search(relo_q):
        relo, relo_q = "unclear", ""

    lang = str(obj.get("language") or "unclear").strip()
    lang_q = str(obj.get("language_quote") or "")
    if lang != "unclear" and not (_quote_in_text(lang_q, text) and _relevant(lang_q, _LANG_RELEVANT)):
        lang, lang_q = "unclear", ""
    # 언어명 정규화: 소문자 단일 토큰(english_only 제외 시 "german" 등)
    if lang not in ("unclear", "english_only"):
        lang = lang.split("(")[0].strip().lower()
        if not re.fullmatch(r"[a-z ]{2,20}", lang):
            lang, lang_q = "unclear", ""

    degree = obj.get("degree")
    degree_q = str(obj.get("degree_quote") or "")
    if degree not in _DEGREE or (degree != "unclear"
                                 and not (_quote_in_text(degree_q, text) and _relevant(degree_q, _DEGREE_RELEVANT))):
        degree, degree_q = "unclear", ""
    # "... or equivalent experience" 가 인용에 있으면 학위는 대체 가능 → not_required 로 교정.
    if degree == "required" and _DEGREE_EQUIVALENT.search(degree_q):
        degree = "not_required"

    return {
        "relocation": relo, "relocation_quote": relo_q[:200],
        "language": lang, "language_quote": lang_q[:200],
        "degree": degree, "degree_quote": degree_q[:200],
    }
