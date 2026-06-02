"""POST /internal/translate — 공고 제목/본문 기계 번역 (DeepL).

DEEPL_API_KEY 미설정 시 503 → 프론트가 '번역 미설정' 안내.
순수 번역만 담당 — 캐싱은 백엔드(job_translations)가 처리한다.
엔진 교체 시 이 파일만 수정하면 backend/web 은 그대로.

DeepL: source_lang 생략 시 언어 자동 감지. title/description 을 한 요청에 함께 보내고
응답 translations 배열을 같은 순서로 되받는다(우리 본문 한도 20k자는 DeepL 단일 요청 범위 내).
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

ENGINE = "deepl"
# 우리 lang 코드 → DeepL target_lang
TARGET_LANG = {"ko": "KO", "en": "EN-US", "ja": "JA", "zh": "ZH"}


class TranslateRequest(BaseModel):
    title: str = ""
    description: str = Field("", max_length=20_000)
    target_lang: str = "ko"


class TranslateResponse(BaseModel):
    title: str
    description: str
    engine: str


def _api_url(key: str) -> str:
    """Free 플랜 키는 ':fx' 접미사 → api-free, 그 외 Pro 엔드포인트."""
    return (
        "https://api-free.deepl.com/v2/translate"
        if key.endswith(":fx")
        else "https://api.deepl.com/v2/translate"
    )


@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest) -> TranslateResponse:
    # .env(settings) 우선, 없으면 실제 환경변수
    key = settings.deepl_api_key or os.getenv("DEEPL_API_KEY")
    if not key:
        raise HTTPException(503, "DEEPL_API_KEY not set — 번역 기능 미설정")
    if not req.title and not req.description:
        raise HTTPException(400, "title/description 모두 비어있음")

    target = TARGET_LANG.get(req.target_lang, req.target_lang.upper())
    # source_lang 생략 → DeepL 자동 감지. title/description 순으로 보냄(빈 건 제외).
    fields: list[tuple[str, str]] = [("target_lang", target)]
    order: list[str] = []
    if req.title:
        fields.append(("text", req.title))
        order.append("title")
    if req.description:
        fields.append(("text", req.description))
        order.append("description")

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                _api_url(key),
                headers={"Authorization": f"DeepL-Auth-Key {key}"},
                data=fields,
            )
        if resp.status_code != 200:
            log.warning("deepl HTTP %s: %s", resp.status_code, resp.text[:300])
            raise HTTPException(502, f"translation upstream error ({resp.status_code})")
        translations = resp.json()["translations"]
        result = {name: translations[i]["text"] for i, name in enumerate(order)}
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
        log.warning("deepl 호출 실패: %s", e)
        raise HTTPException(502, f"translation request failed: {e}") from e

    return TranslateResponse(
        title=result.get("title", req.title),
        description=result.get("description", ""),
        engine=ENGINE,
    )
