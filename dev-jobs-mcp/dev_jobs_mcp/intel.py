"""회사 평판/언급 정보 통합.

데이터 소스 (모두 무료, 키 불필요):
- HN Algolia API (hn.algolia.com/api/v1/search) - 해커뉴스 글/댓글
- 회사 메타데이터 (registry.py 의 tags)

향후 확장 여지: Glassdoor (스크래핑), 회사 엔지니어링 블로그 RSS, levels.fyi 등.
"""
from __future__ import annotations
import httpx
from datetime import datetime, timezone, timedelta
from .registry import resolve as resolve_company

HN_API = "https://hn.algolia.com/api/v1/search"


async def get_company_intel(company: str, months_back: int = 12) -> dict:
    """회사 평판 정보 통합 조회.

    Returns:
        - company_info: 등록된 ATS/태그 정보 (있으면)
        - hn_mentions: 최근 HN 글/댓글 (제목, 점수, 댓글 수, URL)
        - hn_sentiment_hints: 단순 시그널 (양/음/중립 키워드 카운트)
        - tldr: 요약 정보 (Claude 가 자연어로 확장하기 좋게)
    """
    result: dict = {"company": company}

    # 1) 레지스트리에서 회사 메타데이터
    info = resolve_company(company)
    if info:
        result["company_info"] = {
            "ats": info["ats"],
            "ats_token": info["token"],
            "tags": info.get("tags", []),
        }
    else:
        result["company_info"] = {"note": "레지스트리에 등록되지 않은 회사"}

    # 2) HN 언급 검색
    hn_data = await _fetch_hn_mentions(company, months_back)
    result["hn_mentions"] = hn_data["mentions"]
    result["hn_total_hits"] = hn_data["total"]

    # 3) 단순 sentiment 시그널 (Claude 의 자연어 분석 보조용)
    result["hn_sentiment_hints"] = _extract_sentiment_hints(hn_data["mentions"])

    # 4) tldr
    result["tldr"] = {
        "registered_in_mcp": info is not None,
        "hn_mention_count": hn_data["total"],
        "top_story_score": max((m["points"] for m in hn_data["mentions"]), default=0),
        "note": "HN 언급은 양/음 모두 포함됨. Claude 가 sentiment_hints 와 mentions 텍스트를 봐서 종합 판단할 것.",
    }
    return result


async def _fetch_hn_mentions(company: str, months_back: int) -> dict:
    """HN Algolia API 로 최근 언급 조회."""
    # months_back 검증 — 음수/0/거대값(OverflowError·미래 timestamp로 빈 결과) 방지
    try:
        months_back = max(1, min(int(months_back), 120))
    except (TypeError, ValueError):
        months_back = 12
    since = datetime.now(timezone.utc) - timedelta(days=months_back * 30)
    since_ts = int(since.timestamp())

    params = {
        "query": company,
        "tags": "story",
        "numericFilters": f"created_at_i>{since_ts}",
        "hitsPerPage": "20",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(HN_API, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        return {"mentions": [], "total": 0, "error": str(e)}

    mentions = []
    for hit in data.get("hits", []):
        mentions.append({
            "title": hit.get("title") or hit.get("story_title", ""),
            "url": hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}",
            "hn_url": f"https://news.ycombinator.com/item?id={hit.get('objectID')}",
            "points": hit.get("points", 0),
            "num_comments": hit.get("num_comments", 0),
            "author": hit.get("author"),
            "created_at": hit.get("created_at"),
        })

    # 점수순 정렬
    mentions.sort(key=lambda m: m["points"] or 0, reverse=True)
    return {"mentions": mentions[:10], "total": data.get("nbHits", 0)}


# 매우 단순한 키워드 시그널. 정교한 sentiment 는 Claude 에게 맡김.
POSITIVE_KEYWORDS = [
    "great", "excellent", "amazing", "love", "best", "innovative",
    "transparent", "well-run", "fair", "respect",
]
NEGATIVE_KEYWORDS = [
    "layoff", "layoffs", "fired", "toxic", "scam", "lawsuit",
    "controversy", "shutdown", "scandal", "burnout", "exploitation",
]


def _extract_sentiment_hints(mentions: list[dict]) -> dict:
    """제목에서 양/음 키워드 카운트. 매우 거친 시그널일 뿐."""
    pos = neg = 0
    for m in mentions:
        title = (m.get("title") or "").lower()
        pos += sum(1 for kw in POSITIVE_KEYWORDS if kw in title)
        neg += sum(1 for kw in NEGATIVE_KEYWORDS if kw in title)
    return {
        "positive_keyword_hits": pos,
        "negative_keyword_hits": neg,
        "caveat": "키워드 카운트만의 단순 시그널. mentions 의 실제 제목/내용을 보고 Claude 가 종합 판단할 것.",
    }
