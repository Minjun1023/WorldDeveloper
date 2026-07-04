"""UK 스폰서 명부 대조 검증 도구(오프라인, 일회성/주기적).

레지스트리 회사를 Home Office 'Register of licensed sponsors: workers' CSV 와
정밀 매칭해 후보를 출력한다. 사람이 검토 후 companies.json 에 "uk_sponsor": true
를 수동 반영한다. 런타임 ETL 과 무관.

사용:
  python scripts/verify_uk_sponsors.py /path/to/register.csv
  python scripts/verify_uk_sponsors.py            # gov.uk 에서 당일 CSV 자동 다운로드
"""
from __future__ import annotations

import csv
import io
import json
import re
import sys
from pathlib import Path
from urllib.request import Request, urlopen

# 정규화·매칭은 공유 모듈(이름 + 위치 disambiguation + confidence)로 통일. h1b/ind 와 동일.
from sponsor_match import company_names, find_candidates

PUBLICATION = "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers"
REGISTRY_PATH = Path(__file__).parent.parent / "dev_jobs_core" / "data" / "companies.json"


def _row_location(row: dict) -> str:
    """UK 명부 행에서 위치(Town/City + County) 추출. 헤더 변형에 관대하게."""
    town = county = ""
    for k, v in row.items():
        kl = (k or "").lower()
        if "town" in kl or "city" in kl:
            town = (v or "").strip()
        elif "county" in kl:
            county = (v or "").strip()
    return " ".join(p for p in (town, county) if p)


def _fetch_csv_url() -> str:
    req = Request(PUBLICATION, headers={"User-Agent": "Mozilla/5.0"})
    html = urlopen(req, timeout=30).read().decode("utf-8", "replace")
    m = re.search(r'https://[^\s"\']+\.csv', html)
    if not m:
        raise SystemExit("CSV 링크를 publication 페이지에서 못 찾음")
    return m.group(0)


def _rows(path: str | None):
    if path:
        with open(path, newline="", encoding="utf-8", errors="replace") as f:
            yield from csv.DictReader(f)
        return
    url = _fetch_csv_url()
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = urlopen(req, timeout=120).read().decode("utf-8", "replace")
    yield from csv.DictReader(io.StringIO(data))


def _load_register(path: str | None) -> list[tuple[str, str]]:
    """명부 → (조직명, 위치) 목록. 위치는 Town/City + County."""
    out = []
    for row in _rows(path):
        org = (row.get("Organisation Name") or "").strip()
        if org:
            out.append((org, _row_location(row)))
    return out


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else None
    register = _load_register(path)
    with open(REGISTRY_PATH, encoding="utf-8") as f:
        data = json.load(f)
    cos = {k: v for k, v in data.items() if not k.startswith("_")}

    hits = []
    for name, info in cos.items():
        cands = find_candidates(company_names(name, info), info.get("hq"), register)
        if cands:
            hits.append((name, info, cands[0]))

    print(f"=== UK 명부 매칭 후보: {len(hits)}/{len(cos)} (검토 후 companies.json 반영) ===")
    print("    confidence: high=이름+위치일치 / medium=단독 이름일치 / low=동명 모호(검토 필수)")
    for name, info, c in sorted(hits, key=lambda h: ({"high": 0, "medium": 1, "low": 2}[h[2].confidence], h[0])):
        already = " [이미 플래그됨]" if info.get("uk_sponsor") is True else ""
        dom = f" <{info['domain']}>" if info.get("domain") else ""
        loc = f" @{c.loc}" if c.loc else ""
        print(f"  [{c.confidence:<6}] {name:<16}{dom} [{info.get('ats')}] -> {c.org}{loc}{already}")


if __name__ == "__main__":
    main()
