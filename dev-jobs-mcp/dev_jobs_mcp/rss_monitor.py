"""회사 채용/기술 블로그 RSS·Atom 구독 + 신규 글 감지.

별도의 SQLite 테이블 (subscriptions, seen_entries) 을 tracker DB 와 같은 파일에 둔다.
deps 추가 없이 xml.etree 로 파싱 (RSS 2.0 / Atom 1.0 둘 다 지원).
"""
from __future__ import annotations
import asyncio
import re
import sqlite3
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx

DB_PATH = Path.home() / ".dev-jobs-mcp" / "applications.db"

# Atom/RSS 네임스페이스 (Atom 은 default ns 사용)
_NS = {"atom": "http://www.w3.org/2005/Atom"}


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS rss_subscriptions (
            company TEXT PRIMARY KEY,
            feed_url TEXT NOT NULL,
            kind TEXT DEFAULT 'blog',
            subscribed_at TEXT NOT NULL,
            last_checked_at TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS rss_seen_entries (
            company TEXT NOT NULL,
            entry_id TEXT NOT NULL,
            title TEXT,
            link TEXT,
            published_at TEXT,
            first_seen_at TEXT NOT NULL,
            PRIMARY KEY (company, entry_id)
        )
    """)
    return conn


def subscribe(company: str, feed_url: str, kind: str = "blog") -> dict:
    """회사 블로그 RSS/Atom 피드 구독. 같은 company 가 이미 있으면 URL 갱신."""
    now = datetime.utcnow().isoformat()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO rss_subscriptions(company, feed_url, kind, subscribed_at) "
            "VALUES(?,?,?,?) "
            "ON CONFLICT(company) DO UPDATE SET feed_url=excluded.feed_url, kind=excluded.kind",
            (company.lower(), feed_url, kind, now),
        )
        conn.commit()
    return {"company": company.lower(), "feed_url": feed_url, "kind": kind}


def unsubscribe(company: str) -> dict:
    with _conn() as conn:
        cur = conn.execute("DELETE FROM rss_subscriptions WHERE company=?", (company.lower(),))
        deleted = cur.rowcount
        conn.execute("DELETE FROM rss_seen_entries WHERE company=?", (company.lower(),))
        conn.commit()
    return {"company": company.lower(), "removed": bool(deleted)}


def list_subscriptions() -> list[dict]:
    with _conn() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT company, feed_url, kind, subscribed_at, last_checked_at "
            "FROM rss_subscriptions ORDER BY company"
        ).fetchall()
    return [dict(r) for r in rows]


def _parse_feed(xml_bytes: bytes) -> list[dict]:
    """RSS 2.0 또는 Atom 1.0 피드를 통일된 entry 리스트로 변환."""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return []

    entries: list[dict] = []

    # RSS 2.0: <rss><channel><item>...
    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        guid = (item.findtext("guid") or link or title).strip()
        pub = (item.findtext("pubDate") or "").strip()
        if title or link:
            entries.append({"id": guid, "title": title, "link": link, "published_at": pub})

    # Atom 1.0: <feed><entry>...
    for entry in root.findall("atom:entry", _NS) or root.findall(".//{http://www.w3.org/2005/Atom}entry"):
        ns_uri = "{http://www.w3.org/2005/Atom}"
        title = (entry.findtext(f"{ns_uri}title") or "").strip()
        link_el = entry.find(f"{ns_uri}link")
        link = link_el.get("href", "") if link_el is not None else ""
        eid = (entry.findtext(f"{ns_uri}id") or link or title).strip()
        pub = (entry.findtext(f"{ns_uri}updated") or entry.findtext(f"{ns_uri}published") or "").strip()
        if title or link:
            entries.append({"id": eid, "title": title, "link": link, "published_at": pub})

    return entries


async def _fetch_one(company: str, feed_url: str) -> dict:
    """단일 구독에서 신규 entry 만 반환 + DB 에 seen 표시."""
    try:
        async with httpx.AsyncClient(timeout=15, headers={"User-Agent": "dev-jobs-mcp/0.4"}, follow_redirects=True) as client:
            r = await client.get(feed_url)
            r.raise_for_status()
            entries = _parse_feed(r.content)
    except Exception as e:
        return {"company": company, "error": f"{type(e).__name__}: {e}", "new_entries": []}

    now = datetime.utcnow().isoformat()
    new_entries: list[dict] = []
    with _conn() as conn:
        for e in entries:
            cur = conn.execute(
                "INSERT OR IGNORE INTO rss_seen_entries(company, entry_id, title, link, published_at, first_seen_at) "
                "VALUES(?,?,?,?,?,?)",
                (company, e["id"], e["title"], e["link"], e["published_at"], now),
            )
            if cur.rowcount:
                new_entries.append(e)
        conn.execute("UPDATE rss_subscriptions SET last_checked_at=? WHERE company=?", (now, company))
        conn.commit()

    return {"company": company, "total_entries": len(entries), "new_entries": new_entries}


async def check_new_posts(company: str | None = None) -> dict:
    """모든 구독(또는 특정 company)에서 신규 글만 가져온다."""
    with _conn() as conn:
        conn.row_factory = sqlite3.Row
        if company:
            rows = conn.execute(
                "SELECT company, feed_url FROM rss_subscriptions WHERE company=?",
                (company.lower(),),
            ).fetchall()
        else:
            rows = conn.execute("SELECT company, feed_url FROM rss_subscriptions").fetchall()
    subs = [dict(r) for r in rows]
    if not subs:
        return {"checked": 0, "results": [], "note": "구독된 피드가 없습니다. subscribe_company_blog 로 먼저 추가하세요."}

    results = await asyncio.gather(*[_fetch_one(s["company"], s["feed_url"]) for s in subs])
    total_new = sum(len(r.get("new_entries", [])) for r in results)
    return {
        "checked": len(results),
        "total_new": total_new,
        "results": results,
    }
