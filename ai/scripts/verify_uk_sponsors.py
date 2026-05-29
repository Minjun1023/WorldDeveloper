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

PUBLICATION = "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers"
REGISTRY_PATH = Path(__file__).parent.parent / "dev_jobs_core" / "data" / "companies.json"

# 법인/지역 접미사만 제거(업종어 bank/payments 등은 회사 구분에 필요하므로 유지).
_SUFFIX = re.compile(
    r"\b(ltd|limited|plc|inc|llc|gmbh|llp|group|holdings|uk|europe|international|branch|ab|se)\b"
)


def normalize(name: str) -> str:
    s = (name or "").lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)   # 구두점 -> 공백 (N.V. -> n v)
    s = _SUFFIX.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def match_company(brand: str, org_name: str) -> bool:
    """우리 회사 brand 가 명부 org_name 의 후보인지(관대). 정밀도는 사람 검토가 책임.

    규칙: 정규화 후 정확 일치, 또는 (brand 길이>=4) org 의 첫 토큰이 brand 와 정확히 같음.
    4자 미만 브랜드는 정확 일치만(오탐 폭주 방지).
    """
    nb = normalize(brand)
    no = normalize(org_name)
    if not nb or not no:
        return False
    if no == nb:
        return True
    if len(nb) >= 4 and no.startswith(nb + " "):
        return no.split(" ", 1)[0] == nb
    return False


def _fetch_csv_url() -> str:
    req = Request(PUBLICATION, headers={"User-Agent": "Mozilla/5.0"})
    html = urlopen(req, timeout=30).read().decode("utf-8", "replace")
    m = re.search(r'https://[^\s"\']+\.csv', html)
    if not m:
        raise SystemExit("CSV 링크를 publication 페이지에서 못 찾음")
    return m.group(0)


def _load_register(path: str | None) -> list[str]:
    if path:
        with open(path, newline="", encoding="utf-8", errors="replace") as f:
            return [row["Organisation Name"].strip() for row in csv.DictReader(f)]
    url = _fetch_csv_url()
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = urlopen(req, timeout=120).read().decode("utf-8", "replace")
    return [row["Organisation Name"].strip() for row in csv.DictReader(io.StringIO(data))]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else None
    orgs = _load_register(path)
    with open(REGISTRY_PATH, encoding="utf-8") as f:
        data = json.load(f)
    cos = {k: v for k, v in data.items() if not k.startswith("_")}

    reg_index: dict[str, str] = {}
    for on in orgs:
        reg_index.setdefault(normalize(on), on)

    hits = []
    for name, info in cos.items():
        matched = None
        for brand in {name, info.get("token", "")}:
            for on in reg_index.values():
                if match_company(brand, on):
                    matched = on
                    break
            if matched:
                break
        if matched:
            hits.append((name, info.get("ats"), matched, info.get("uk_sponsor") is True))

    print(f"=== UK 명부 매칭 후보: {len(hits)}/{len(cos)} (검토 후 companies.json 반영) ===")
    for name, ats, org, already in sorted(hits):
        flag = " [이미 플래그됨]" if already else ""
        print(f"  {name:<16} [{ats}] -> {org}{flag}")


if __name__ == "__main__":
    main()
