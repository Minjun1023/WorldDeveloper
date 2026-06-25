"""비자 가이드 마크다운 파서 + visa_guides 시드."""
from __future__ import annotations

import logging
import re
from pathlib import Path

log = logging.getLogger(__name__)

_SECTION_RE = re.compile(r"^##\s+(?P<key>[\w]+)\s*:\s*(?P<title>.+)$")
_SOURCE_RE = re.compile(r"^source:\s*(?P<url>\S+)\s*$", re.IGNORECASE)
_RETRIEVED_RE = re.compile(r"^retrieved:\s*(?P<date>\d{4}-\d{2}-\d{2})\s*$", re.IGNORECASE)


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


def seed(guides_dir: str | None = None) -> int:
    """가이드 마크다운 → 임베딩 → visa_guides upsert. 반환: upsert 행 수.

    디렉터리 우선순위: 인자 > VISA_GUIDES_DIR 환경변수 > 레포 docs/visa-guides.
    (프로덕션은 ai 빌드 컨텍스트에 docs/ 가 없으므로 VISA_GUIDES_DIR 로 마운트 경로를 지정한다.)
    """
    import os

    import psycopg
    from pgvector.psycopg import register_vector

    from app.config import settings
    from dev_jobs_core.recommender.embeddings import embed_text

    chosen = guides_dir or os.getenv("VISA_GUIDES_DIR")
    base = Path(chosen) if chosen else Path(__file__).resolve().parents[2] / "docs" / "visa-guides"
    files = sorted(base.glob("*.md"))
    if not files:
        log.warning("시드할 가이드 파일 없음: %s", base)
        return 0

    n = 0
    with psycopg.connect(settings.database_url) as conn:
        register_vector(conn)
        for f in files:
            country = f.stem  # us/gb/de/nl/ca
            chunks = parse_guide_md(country, f.read_text(encoding="utf-8"))
            for c in chunks:
                if not c["source_url"] or not c["retrieved_at"]:
                    log.warning("source/retrieved 누락 — 건너뜀: %s %s", country, c["section"])
                    continue
                vec = embed_text(f"{c['title']}\n{c['content']}")
                conn.execute(
                    """
                    INSERT INTO visa_guides (country, section, title, content, source_url, retrieved_at, embedding)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (country, section) DO UPDATE SET
                      title = EXCLUDED.title, content = EXCLUDED.content,
                      source_url = EXCLUDED.source_url, retrieved_at = EXCLUDED.retrieved_at,
                      embedding = EXCLUDED.embedding
                    """,
                    (country, c["section"], c["title"], c["content"],
                     c["source_url"], c["retrieved_at"], vec),
                )
                n += 1
        conn.commit()
    log.info("visa_guides 시드 완료: %d 청크", n)
    return n
