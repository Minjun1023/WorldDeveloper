"""네덜란드 IND 인정 스폰서(erkende referenten) 명부 대조 검증 도구(오프라인, 일회성/주기적).

레지스트리 회사를 IND 공개 명부의 조직명과 정밀 매칭해 후보를 출력한다. 사람이 검토 후
companies.json 에 "ind_sponsor": true 를 수동 반영한다. 런타임 ETL 과 무관.

IND 공개 명부는 CSV 다운로드를 제공하지 않고 월 1회 갱신되는 HTML 표라, 조직명을 텍스트로
저장해 경로로 넘긴다(한 줄에 하나, 또는 첫 열이 조직명인 CSV):
  https://ind.nl/en/public-register-recognised-sponsors/public-register-work 에서
  'Regular labour and highly skilled migrants' 표의 조직명을 복사·저장 후:
    python scripts/verify_ind_sponsors.py /path/to/ind_register.txt
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

# UK 스크립트의 정밀 정규화 매칭 재사용(DRY).
from verify_uk_sponsors import match_company, normalize

REGISTRY_PATH = Path(__file__).parent.parent / "dev_jobs_core" / "data" / "companies.json"


def load_org_names(path: str) -> list[str]:
    """IND 명부 파일에서 조직명 목록. CSV 면 첫 열, 아니면 한 줄에 하나."""
    text = Path(path).read_text(encoding="utf-8", errors="replace")
    names: list[str] = []
    if "," in text.splitlines()[0] if text.splitlines() else False:
        for row in csv.reader(text.splitlines()):
            if row and row[0].strip():
                names.append(row[0].strip())
    else:
        names = [ln.strip() for ln in text.splitlines() if ln.strip()]
    # 흔한 헤더 행 제거
    return [n for n in names if n.lower() not in {"organisation", "organisation name", "name"}]


def main():
    if len(sys.argv) < 2:
        raise SystemExit("사용: python scripts/verify_ind_sponsors.py /path/to/ind_register.txt")
    orgs = load_org_names(sys.argv[1])

    with open(REGISTRY_PATH, encoding="utf-8") as f:
        data = json.load(f)
    cos = {k: v for k, v in data.items() if not k.startswith("_")}

    org_index: dict[str, str] = {}
    for o in orgs:
        org_index.setdefault(normalize(o), o)

    hits = []
    for name, info in cos.items():
        matched = None
        for brand in {name, info.get("token", "")}:
            for o in org_index.values():
                if match_company(brand, o):
                    matched = o
                    break
            if matched:
                break
        if matched:
            hits.append((name, info.get("ats"), matched, info.get("ind_sponsor") is True))

    print(f"=== IND 매칭 후보: {len(hits)}/{len(cos)} (검토 후 companies.json 반영) ===")
    for name, ats, org, already in sorted(hits):
        flag = " [이미 플래그됨]" if already else ""
        print(f"  {name:<16} [{ats}] -> {org}{flag}")


if __name__ == "__main__":
    main()
