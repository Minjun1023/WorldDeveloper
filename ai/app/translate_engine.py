"""공고 번역 엔진 (LibreTranslate 셀프호스팅).

온디맨드 라우트(/internal/translate)와 ETL 사전번역(backfill_translations)이 공유한다.
긴 본문은 블록 종료 태그 경계로 청크 분할 후 병렬 번역해 지연/타임아웃을 줄인다.
엔진 교체(DeepL/Google 등) 시 이 파일만 수정.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re

import httpx

from .config import settings

log = logging.getLogger(__name__)

ENGINE = "libretranslate"
_MAX_CHUNK = 3500  # 청크 최대 글자수(긴 본문 단일요청 타임아웃 방지)
_CONCURRENCY = 4  # LibreTranslate 동시 호출 상한(단일 인스턴스 과부하 방지)
_TIMEOUT = 60

# 블록 종료 태그 경계에서만 자른다(태그 균형 유지) — 인라인 태그는 청크 내부에 보존된다.
_BLOCK_BREAK = re.compile(
    r"(</(?:p|li|ul|ol|div|h[1-6]|tr|table|section|blockquote|pre)>)", re.I
)


class TranslationUnavailable(Exception):
    """LIBRETRANSLATE_URL 미설정 — 번역 비활성(라우트가 503 으로 매핑)."""


class TranslationUpstreamError(Exception):
    """LibreTranslate 서버 미기동/오류(라우트가 502 로 매핑)."""


def _base_url() -> str:
    return (settings.libretranslate_url or os.getenv("LIBRETRANSLATE_URL") or "").rstrip("/")


def _api_key() -> str:
    return settings.libretranslate_api_key or os.getenv("LIBRETRANSLATE_API_KEY") or ""


def split_html(html: str, max_len: int = _MAX_CHUNK) -> list[str]:
    """본문 HTML 을 블록 종료 태그 경계로 분할. 짧으면 그대로 1개. 태그를 가르지 않는다."""
    if len(html) <= max_len:
        return [html] if html else []
    tokens = _BLOCK_BREAK.split(html)  # 구분자(닫는 블록 태그)를 보존하며 분할
    blocks: list[str] = []
    i = 0
    while i < len(tokens):
        seg = tokens[i]
        if i + 1 < len(tokens):
            seg += tokens[i + 1]  # 닫는 블록 태그를 같은 조각에 붙인다
            i += 2
        else:
            i += 1
        if seg:
            blocks.append(seg)
    chunks: list[str] = []
    cur = ""
    for b in blocks:
        if cur and len(cur) + len(b) > max_len:
            chunks.append(cur)
            cur = b
        else:
            cur += b
    if cur:
        chunks.append(cur)
    return chunks


async def _lt_call(
    client: httpx.AsyncClient, base_url: str, api_key: str, target: str, text: str, fmt: str
) -> str:
    if not text:
        return ""
    payload: dict[str, str] = {"q": text, "source": "auto", "target": target, "format": fmt}
    if api_key:
        payload["api_key"] = api_key
    resp = await client.post(f"{base_url}/translate", json=payload)
    if resp.status_code != 200:
        log.warning("libretranslate HTTP %s: %s", resp.status_code, resp.text[:300])
        raise TranslationUpstreamError(f"upstream {resp.status_code}")
    return resp.json()["translatedText"]


async def translate_pair(title: str, description: str, target: str = "ko") -> tuple[str, str, str]:
    """제목(text) + 본문(html, 청크 병렬)을 target 으로 번역. 반환 (title, description, engine)."""
    base_url = _base_url()
    if not base_url:
        raise TranslationUnavailable("LIBRETRANSLATE_URL not set")
    api_key = _api_key()
    chunks = split_html(description or "")
    sem = asyncio.Semaphore(_CONCURRENCY)

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:

        async def _chunk(text: str) -> str:
            async with sem:
                return await _lt_call(client, base_url, api_key, target, text, "html")

        try:
            title_t = await _lt_call(client, base_url, api_key, target, title or "", "text")
            parts = await asyncio.gather(*[_chunk(c) for c in chunks]) if chunks else []
        except (httpx.HTTPError, KeyError, ValueError) as e:
            log.warning("libretranslate 호출 실패: %s", e)
            raise TranslationUpstreamError(str(e)) from e

    return (title_t or title, "".join(parts), ENGINE)
