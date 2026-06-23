"""POST /internal/translate — 공고 제목/본문 기계 번역.

실제 번역 로직은 app.translate_engine(DeepL)에 있다 — 온디맨드/ETL 백필이 공유.
키 미설정이면 503, 업스트림 오류(한도초과 등)는 502. 캐싱은 백엔드(job_translations)가 처리.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..translate_engine import (
    TranslationUnavailable,
    TranslationUpstreamError,
    translate_pair,
)

log = logging.getLogger(__name__)
router = APIRouter()


class TranslateRequest(BaseModel):
    title: str = ""
    description: str = Field("", max_length=60_000)
    target_lang: str = "ko"


class TranslateResponse(BaseModel):
    title: str
    description: str
    engine: str


@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest) -> TranslateResponse:
    if not req.title and not req.description:
        raise HTTPException(400, "title/description 모두 비어있음")
    try:
        title, description, engine = await translate_pair(req.title, req.description, req.target_lang)
    except TranslationUnavailable as e:
        raise HTTPException(503, f"{e}") from e
    except TranslationUpstreamError as e:
        raise HTTPException(502, f"translation request failed: {e}") from e
    return TranslateResponse(title=title, description=description, engine=engine)
