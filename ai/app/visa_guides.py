"""비자 가이드 마크다운 파서 + visa_guides 시드."""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path

import httpx

log = logging.getLogger(__name__)

_SECTION_RE = re.compile(r"^##\s+(?P<key>[\w]+)\s*:\s*(?P<title>.+)$")
_SOURCE_RE = re.compile(r"^source:\s*(?P<url>\S+)\s*$", re.IGNORECASE)
_RETRIEVED_RE = re.compile(r"^retrieved:\s*(?P<date>\d{4}-\d{2}-\d{2})\s*$", re.IGNORECASE)

OPENAI_URL = "https://api.openai.com/v1/chat/completions"

_SYNTH_SYSTEM = (
    "You write a short Korean visa guide for a Korean software engineer applying to an overseas role. "
    "Answer in Korean; keep visa names/terms in English (e.g. H-1B, Blue Card, Skilled Worker). "
    "Ground EVERYTHING ONLY in the provided guide chunks. "
    "NEVER invent visa names, salary thresholds, processing times, or rules not present in the chunks. "
    "If the chunks lack a needed detail, say '공식 사이트에서 확인 필요' instead of guessing. "
    "Focus on: how a Korean developer actually gets sponsored to work in this country "
    "(which visa, what the employer must do, any Korea-specific note). "
    "Do NOT include source URLs or dates in your text — those are attached separately. "
    "Write 2-4 concise sentences or short bullets. No preamble, no disclaimer, no AI self-reference."
)

_DISCLAIMER = (
    "법률·이민 자문이 아닙니다. {date} 기준 정보이며 비자 규정은 자주 바뀝니다. "
    "지원 전 반드시 공식 사이트에서 최신 내용을 확인하세요."
)


def parse_guide_md(country: str, text: str) -> list[dict]:
    """마크다운 → 섹션 청크 리스트. 각 청크: country/section/title/source_url/retrieved_at/content."""
    chunks: list[dict] = []
    cur: dict | None = None
    body: list[str] = []

    def _flush():
        if cur is not None:
            cur["content"] = "\n".join(body).strip()
            chunks.append(cur)

    for line in text.splitlines():
        m = _SECTION_RE.match(line.strip())
        if m:
            _flush()
            cur = {"country": country, "section": m.group("key").strip(),
                   "title": m.group("title").strip(), "source_url": "", "retrieved_at": ""}
            body = []
            continue
        if cur is None:
            continue  # 첫 섹션 이전 서문 무시
        ms = _SOURCE_RE.match(line.strip())
        if ms:
            cur["source_url"] = ms.group("url")
            continue
        mr = _RETRIEVED_RE.match(line.strip())
        if mr:
            cur["retrieved_at"] = mr.group("date")
            continue
        body.append(line)
    _flush()
    return [c for c in chunks if c["content"]]


def synthesize_country_guide(country: str, chunks: list[dict]) -> str | None:
    """회수 청크에만 근거한 국가 비자 가이드 단락. 키 없음/실패 시 None."""
    import os

    from app.config import settings
    key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not key or not chunks:
        return None
    user_payload = json.dumps({"country": country, "guide_chunks": chunks}, ensure_ascii=False)
    body = {
        "model": settings.openai_model,
        "temperature": 0.2,
        "max_tokens": 500,
        "messages": [
            {"role": "system", "content": _SYNTH_SYSTEM},
            {"role": "user", "content": user_payload},
        ],
    }
    try:
        resp = httpx.post(OPENAI_URL, headers={"Authorization": f"Bearer {key}",
                                               "content-type": "application/json"},
                          json=body, timeout=60)
        if resp.status_code != 200:
            log.warning("country-guide HTTP %s: %s", resp.status_code, resp.text[:200])
            return None
        text = (resp.json()["choices"][0]["message"]["content"] or "").strip()
        return text or None
    except (httpx.HTTPError, KeyError, IndexError) as e:
        log.warning("country-guide 합성 실패: %s", e)
        return None


def _country_sources(chunks: list[dict]) -> tuple[list[dict], str]:
    """청크에서 출처(중복 url 제거) + 최신 작성일을 결정적으로 조립."""
    sources, seen = [], set()
    for c in chunks:
        url, date = c.get("source_url", ""), c.get("retrieved_at", "")
        if url and date and url not in seen:
            seen.add(url)
            sources.append({"title": c.get("title", ""), "url": url, "retrieved_at": date})
    max_date = max((c.get("retrieved_at", "") for c in chunks if c.get("retrieved_at")), default="")
    return sources, max_date


def _wait_for_table(dsn: str, attempts: int = 20, delay: float = 3.0) -> bool:
    """visa_country_guides 테이블이 생길 때까지 폴링(autocommit 으로 최신 카탈로그 확인).

    배포 직후 backend Flyway(V26) 가 테이블을 만들기 전에 시드가 먼저 도는 레이스를 막는다.
    생기면 True, 시도 초과면 False.
    """
    import time

    import psycopg

    for _ in range(attempts):
        with psycopg.connect(dsn, autocommit=True) as conn:
            row = conn.execute("SELECT to_regclass('public.visa_country_guides')").fetchone()
        if row and row[0] is not None:
            return True
        time.sleep(delay)
    return False


def seed(guides_dir: str | None = None) -> int:
    """가이드 마크다운 → 청크 upsert + 국가별 가이드 사전합성 upsert. 반환: 합성된 국가 수."""
    import os

    import psycopg

    from app.config import settings

    chosen = guides_dir or os.getenv("VISA_GUIDES_DIR")
    base = Path(chosen) if chosen else Path(__file__).resolve().parents[2] / "docs" / "visa-guides"
    files = sorted(base.glob("*.md"))
    if not files:
        log.warning("시드할 가이드 파일 없음: %s", base)
        return 0
    if not _wait_for_table(settings.database_url):
        log.warning("visa 테이블 없음(마이그레이션 대기 초과) — 시드 건너뜀")
        return 0

    countries = 0
    with psycopg.connect(settings.database_url) as conn:
        for f in files:
            country = f.stem  # us/gb/de/nl/ca
            chunks = parse_guide_md(country, f.read_text(encoding="utf-8"))
            chunks = [c for c in chunks if c["source_url"] and c["retrieved_at"]]
            if not chunks:
                continue
            for c in chunks:
                conn.execute(
                    """
                    INSERT INTO visa_guides (country, section, title, content, source_url, retrieved_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (country, section) DO UPDATE SET
                      title = EXCLUDED.title, content = EXCLUDED.content,
                      source_url = EXCLUDED.source_url, retrieved_at = EXCLUDED.retrieved_at
                    """,
                    (country, c["section"], c["title"], c["content"], c["source_url"], c["retrieved_at"]),
                )
            guide = synthesize_country_guide(country, chunks)
            if not guide:
                log.warning("가이드 합성 실패 — 건너뜀: %s", country)
                continue
            sources, max_date = _country_sources(chunks)
            disclaimer = _DISCLAIMER.format(date=max_date)
            conn.execute(
                """
                INSERT INTO visa_country_guides (country, guide_text, sources, disclaimer, generated_at)
                VALUES (%s, %s, %s, %s, now())
                ON CONFLICT (country) DO UPDATE SET
                  guide_text = EXCLUDED.guide_text, sources = EXCLUDED.sources,
                  disclaimer = EXCLUDED.disclaimer, generated_at = now()
                """,
                (country, guide, json.dumps(sources, ensure_ascii=False), disclaimer),
            )
            countries += 1
        conn.commit()
    log.info("visa_country_guides 시드 완료: %d개국", countries)
    return countries
