"""POST /internal/translate — 공고 제목/본문 기계 번역 (LibreTranslate 셀프호스팅).

LIBRETRANSLATE_URL(기본 http://localhost:5050) 의 로컬 서버를 호출 — 외부 API/키 불필요.
URL 을 빈 값으로 두면 번역 비활성(503). 서버 미기동/오류는 502.
순수 번역만 담당 — 캐싱은 백엔드(job_translations)가 처리. 엔진 교체 시 이 파일만 수정.

LibreTranslate: source 'auto' 자동 감지. title/description 각각 번역.
"""
from __future__ import annotations

import logging
import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import settings

log = logging.getLogger(__name__)
router = APIRouter()

ENGINE = "libretranslate"


class TranslateRequest(BaseModel):
    title: str = ""
    description: str = Field("", max_length=20_000)
    target_lang: str = "ko"


class TranslateResponse(BaseModel):
    title: str
    description: str
    engine: str


async def _lt_translate(
    client: httpx.AsyncClient, base_url: str, api_key: str, target: str, text: str
) -> str:
    """LibreTranslate /translate 호출. 빈 텍스트는 그대로 빈 문자열."""
    if not text:
        return ""
    payload: dict[str, str] = {"q": text, "source": "auto", "target": target, "format": "text"}
    if api_key:
        payload["api_key"] = api_key
    resp = await client.post(f"{base_url}/translate", json=payload)
    if resp.status_code != 200:
        log.warning("libretranslate HTTP %s: %s", resp.status_code, resp.text[:300])
        raise HTTPException(502, f"translation upstream error ({resp.status_code})")
    return resp.json()["translatedText"]


@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest) -> TranslateResponse:
    # .env(settings) 우선, 없으면 실제 환경변수
    base_url = (settings.libretranslate_url or os.getenv("LIBRETRANSLATE_URL") or "").rstrip("/")
    if not base_url:
        raise HTTPException(503, "LIBRETRANSLATE_URL not set — 번역 기능 미설정")
    if not req.title and not req.description:
        raise HTTPException(400, "title/description 모두 비어있음")

    api_key = settings.libretranslate_api_key or os.getenv("LIBRETRANSLATE_API_KEY") or ""
    target = req.target_lang

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            title = await _lt_translate(client, base_url, api_key, target, req.title)
            description = await _lt_translate(client, base_url, api_key, target, req.description)
    except (httpx.HTTPError, KeyError, ValueError) as e:
        log.warning("libretranslate 호출 실패: %s", e)
        raise HTTPException(502, f"translation request failed: {e}") from e

    return TranslateResponse(
        title=title or req.title,
        description=description,
        engine=ENGINE,
    )
