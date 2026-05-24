"""POST /internal/translate — 공고 제목/본문 기계 번역 (OpenAI gpt-4o-mini).

OPENAI_API_KEY 미설정 시 503 (백엔드/프론트가 '번역 미설정'으로 안내).
순수 번역만 담당 — 캐싱은 백엔드(job_translations)가 처리한다.
엔진 교체 시 이 파일만 수정하면 backend/web 은 그대로.
"""
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

LANG_NAMES = {"ko": "Korean", "en": "English", "ja": "Japanese", "zh": "Chinese"}


class TranslateRequest(BaseModel):
    title: str = ""
    description: str = Field("", max_length=20_000)
    target_lang: str = "ko"


class TranslateResponse(BaseModel):
    title: str
    description: str
    engine: str


def _build_prompt(title: str, description: str, lang_name: str) -> tuple[str, str]:
    system = (
        f"You are a professional translator for software engineering job postings. "
        f"Translate the given title and description into {lang_name}. "
        "Keep technical terms, programming languages, frameworks, tool names, company "
        "names, and code snippets in English. Keep the translation natural and concise. "
        'Respond with ONLY a JSON object: {"title": "...", "description": "..."} '
        "and nothing else."
    )
    user = json.dumps({"title": title, "description": description}, ensure_ascii=False)
    return system, user


def _parse(text: str, fallback_title: str) -> tuple[str, str]:
    """모델 출력에서 {title, description} 추출. 실패 시 전체를 description 으로."""
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        if t.startswith("json"):
            t = t[4:]
    try:
        obj = json.loads(t)
        return obj.get("title") or fallback_title, obj.get("description") or ""
    except (json.JSONDecodeError, AttributeError):
        return fallback_title, text.strip()


@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest) -> TranslateResponse:
    # .env(settings) 우선, 없으면 실제 환경변수
    key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(503, "OPENAI_API_KEY not set — 번역 기능 미설정")
    if not req.title and not req.description:
        raise HTTPException(400, "title/description 모두 비어있음")

    lang_name = LANG_NAMES.get(req.target_lang, req.target_lang)
    system, user = _build_prompt(req.title, req.description, lang_name)

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                OPENAI_URL,
                headers={
                    "Authorization": f"Bearer {key}",
                    "content-type": "application/json",
                },
                json={
                    "model": MODEL,
                    "max_tokens": 4096,
                    "temperature": 0.2,
                    # 구조화 출력 — content 가 항상 JSON 객체로 옴
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
            )
        if resp.status_code != 200:
            log.warning("openai HTTP %s: %s", resp.status_code, resp.text[:300])
            raise HTTPException(502, f"translation upstream error ({resp.status_code})")
        data = resp.json()
        text = data["choices"][0]["message"]["content"] or ""
        title, description = _parse(text, req.title)
        return TranslateResponse(title=title, description=description, engine=MODEL)
    except (httpx.HTTPError, KeyError, IndexError) as e:
        log.warning("openai 호출 실패: %s", e)
        raise HTTPException(502, f"translation request failed: {e}") from e
