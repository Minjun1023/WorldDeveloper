"""공고 번역 엔진 — DeepL (관리형, 빠르고 안정적, HTML 보존).

온디맨드 라우트(/internal/translate)와 ETL 백필이 공유. 캐싱은 백엔드(job_translations)가 처리하므로
같은 공고는 한 번만 번역된다. 엔진 교체 시 이 파일만 수정.

DEEPL_API_KEY 는 서버 .env 로만 주입(클라이언트 노출 금지). 무료 키는 ':fx' 로 끝난다.
"""
from __future__ import annotations

import logging
import os

import httpx

from .config import settings

log = logging.getLogger(__name__)

ENGINE = "deepl"
_TIMEOUT = 30


class TranslationUnavailable(Exception):
    """DEEPL_API_KEY 미설정/인증 실패 — 라우트가 503 으로 매핑."""


class TranslationUpstreamError(Exception):
    """DeepL 업스트림 오류(한도초과/타임아웃 등) — 라우트가 502 로 매핑."""


def _deepl_key() -> str:
    return settings.deepl_api_key or os.getenv("DEEPL_API_KEY") or ""


def _deepl_endpoint(key: str) -> str:
    # 무료 키는 ':fx' 로 끝난다 → api-free, 유료는 api.
    return (
        "https://api-free.deepl.com/v2/translate"
        if key.endswith(":fx")
        else "https://api.deepl.com/v2/translate"
    )


async def translate_pair(title: str, description: str, target: str = "ko") -> tuple[str, str, str]:
    """제목 + 본문(HTML)을 target 으로 번역. 반환 (title, description, engine)."""
    key = _deepl_key()
    if not key:
        raise TranslationUnavailable("DEEPL_API_KEY not set")

    # 빈 항목은 제외하고 인덱스 매핑(불필요한 글자수 소모/오류 방지).
    texts: list[str] = []
    ti = di = -1
    if title:
        ti = len(texts)
        texts.append(title)
    if description:
        di = len(texts)
        texts.append(description)
    if not texts:
        return (title, description, ENGINE)

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                _deepl_endpoint(key),
                headers={
                    "Authorization": f"DeepL-Auth-Key {key}",
                    "Content-Type": "application/json",
                },
                # tag_handling=html 로 HTML 태그 보존하며 본문 텍스트만 번역.
                json={"text": texts, "target_lang": target.upper(), "tag_handling": "html"},
            )
    except httpx.HTTPError as e:
        log.warning("deepl 호출 실패: %s", e)
        raise TranslationUpstreamError(str(e)) from e

    if resp.status_code == 456:
        log.warning("deepl 한도 초과(456)")
        raise TranslationUpstreamError("deepl quota exceeded")
    if resp.status_code in (401, 403):
        raise TranslationUnavailable(f"deepl auth failed ({resp.status_code})")
    if resp.status_code != 200:
        log.warning("deepl HTTP %s: %s", resp.status_code, resp.text[:200])
        raise TranslationUpstreamError(f"deepl upstream {resp.status_code}")

    out = resp.json().get("translations", [])
    t_title = out[ti]["text"] if 0 <= ti < len(out) else title
    t_desc = out[di]["text"] if 0 <= di < len(out) else description
    return (t_title or title, t_desc, ENGINE)
