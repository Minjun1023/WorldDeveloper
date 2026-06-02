"""POST /internal/translate — 공고 제목/본문 기계 번역 (Naver Papago NMT).

PAPAGO_CLIENT_ID / PAPAGO_CLIENT_SECRET (NCP) 미설정 시 503 → 프론트가 '번역 미설정' 안내.
순수 번역만 담당 — 캐싱은 백엔드(job_translations)가 처리한다.
엔진 교체 시 이 파일만 수정하면 backend/web 은 그대로.

Papago 제약: 요청당 text 최대 5000자 → 긴 본문은 청크 분할 후 합침.
영어 외 공고(독일어 등) 대비 언어 자동 감지(detect) 후 번역.
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

PAPAGO_TRANSLATE_URL = "https://naveropenapi.apigw.ntruss.com/nmt/v1/translation"
PAPAGO_DETECT_URL = "https://naveropenapi.apigw.ntruss.com/langs/v1/detect"
ENGINE = "papago"

# Papago 단일 요청 text 한도(5000자). 안전 여유를 둬 청크 분할.
MAX_CHARS = 4500
# Papago NMT 가 target=ko 로 번역 가능한 source 언어. 그 외/ko 는 번역 생략(원문 반환).
SUPPORTED_SOURCE = {"en", "ja", "zh-CN", "zh-TW", "vi", "id", "th", "de", "ru", "es", "it", "fr"}


class TranslateRequest(BaseModel):
    title: str = ""
    description: str = Field("", max_length=20_000)
    target_lang: str = "ko"


class TranslateResponse(BaseModel):
    title: str
    description: str
    engine: str


def _headers(client_id: str, client_secret: str) -> dict[str, str]:
    return {
        "X-NCP-APIGW-API-KEY-ID": client_id,
        "X-NCP-APIGW-API-KEY": client_secret,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    }


def _chunks(text: str, limit: int = MAX_CHARS) -> list[str]:
    """줄 경계 우선으로 limit 이하 청크 분할(문장 중간 절단 최소화)."""
    if len(text) <= limit:
        return [text] if text else []
    out: list[str] = []
    buf = ""
    for line in text.splitlines(keepends=True):
        # 한 줄 자체가 limit 초과 → 강제 분할
        while len(line) > limit:
            if buf:
                out.append(buf)
                buf = ""
            out.append(line[:limit])
            line = line[limit:]
        if len(buf) + len(line) > limit:
            out.append(buf)
            buf = line
        else:
            buf += line
    if buf:
        out.append(buf)
    return out


async def _detect_source(client: httpx.AsyncClient, headers: dict[str, str], sample: str) -> str:
    """샘플 텍스트의 언어 감지. 실패 시 'en' 기본."""
    try:
        resp = await client.post(PAPAGO_DETECT_URL, headers=headers, data={"query": sample[:900]})
        if resp.status_code == 200:
            return resp.json().get("langCode") or "en"
        log.warning("papago detect HTTP %s: %s", resp.status_code, resp.text[:200])
    except (httpx.HTTPError, ValueError) as e:
        log.warning("papago detect 실패: %s", e)
    return "en"


async def _translate_text(
    client: httpx.AsyncClient, headers: dict[str, str], source: str, target: str, text: str
) -> str:
    """text 를 청크별로 번역해 합침."""
    parts: list[str] = []
    for chunk in _chunks(text):
        resp = await client.post(
            PAPAGO_TRANSLATE_URL,
            headers=headers,
            data={"source": source, "target": target, "text": chunk},
        )
        if resp.status_code != 200:
            log.warning("papago translate HTTP %s: %s", resp.status_code, resp.text[:300])
            raise HTTPException(502, f"translation upstream error ({resp.status_code})")
        parts.append(resp.json()["message"]["result"]["translatedText"])
    return "".join(parts)


@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest) -> TranslateResponse:
    # .env(settings) 우선, 없으면 실제 환경변수
    client_id = settings.papago_client_id or os.getenv("PAPAGO_CLIENT_ID")
    client_secret = settings.papago_client_secret or os.getenv("PAPAGO_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(503, "PAPAGO_CLIENT_ID/SECRET not set — 번역 기능 미설정")
    if not req.title and not req.description:
        raise HTTPException(400, "title/description 모두 비어있음")

    target = req.target_lang
    headers = _headers(client_id, client_secret)

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            sample = (req.description or req.title).strip()
            source = await _detect_source(client, headers, sample)
            # 이미 대상 언어이거나 Papago 미지원 source → 번역 불가, 원문 그대로 반환
            if source == target or source not in SUPPORTED_SOURCE:
                return TranslateResponse(
                    title=req.title, description=req.description, engine=ENGINE
                )

            title = (
                await _translate_text(client, headers, source, target, req.title)
                if req.title
                else ""
            )
            description = (
                await _translate_text(client, headers, source, target, req.description)
                if req.description
                else ""
            )
        return TranslateResponse(title=title, description=description, engine=ENGINE)
    except (httpx.HTTPError, KeyError, ValueError) as e:
        log.warning("papago 호출 실패: %s", e)
        raise HTTPException(502, f"translation request failed: {e}") from e
