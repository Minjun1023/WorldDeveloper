"""회사 레지스트리: 회사명 → ATS 매핑 + 태그 기반 검색."""
from __future__ import annotations
import json
from pathlib import Path
from functools import lru_cache

REGISTRY_PATH = Path(__file__).parent / "data" / "companies.json"


@lru_cache(maxsize=1)
def _load() -> dict:
    with open(REGISTRY_PATH) as f:
        data = json.load(f)
    # _meta 제거하고 회사들만
    return {k: v for k, v in data.items() if not k.startswith("_")}


def resolve(name: str) -> dict | None:
    """회사명 → {ats, token, tags} 매핑. 못 찾으면 None.

    Lookup 규칙:
    1. 정확히 일치 (소문자, 공백/하이픈/언더스코어 무시)
    2. 토큰 일치
    """
    registry = _load()
    normalized = _normalize(name)

    # 정확 매치
    for key, info in registry.items():
        if _normalize(key) == normalized:
            return {**info, "name": key}
        if _normalize(info["token"]) == normalized:
            return {**info, "name": key}

    return None


def list_all() -> list[dict]:
    """등록된 모든 회사 정보."""
    registry = _load()
    return [{**info, "name": name} for name, info in registry.items()]


def uk_sponsor_slugs() -> set[str]:
    """UK 스폰서 라이선스 보유로 큐레이션된 회사(uk_sponsor=true)의 토큰 집합."""
    registry = _load()
    return {
        info["token"]
        for info in registry.values()
        if info.get("uk_sponsor") is True
    }


def search_by_tag(tags: list[str]) -> list[dict]:
    """태그로 회사 검색 (OR 조건). 예: ["fintech", "europe"]."""
    registry = _load()
    tags_lower = {t.lower() for t in tags}
    results = []
    for name, info in registry.items():
        company_tags = {t.lower() for t in info.get("tags", [])}
        if company_tags & tags_lower:
            results.append({**info, "name": name})
    return results


def _normalize(s: str) -> str:
    return s.lower().replace("-", "").replace("_", "").replace(" ", "")
