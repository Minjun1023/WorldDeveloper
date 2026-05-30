"""USCIS H-1B Employer Data Hub 대조 검증 도구(오프라인, 일회성/주기적).

레지스트리 회사를 H-1B 고용주 명단과 정밀 매칭해 후보를 출력한다(승인 이력 있는
고용주만). 사람이 검토 후 companies.json 에 "h1b_sponsor": true 를 수동 반영한다.
런타임 ETL 과 무관.

USCIS 는 자동 다운로드를 차단할 수 있어 CSV 경로를 인자로 받는다(수동 다운로드):
  https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub 에서
  연도별 CSV 를 받아:
    python scripts/verify_h1b_sponsors.py /path/to/h1b_datahub_export.csv
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

# UK 스크립트의 정밀 정규화 매칭 재사용(DRY). 둘 다 main()에서 사용.
from verify_uk_sponsors import match_company, normalize

REGISTRY_PATH = Path(__file__).parent.parent / "dev_jobs_core" / "data" / "companies.json"


def _find_col(fieldnames: list[str], *needles: str) -> str | None:
    for f in fieldnames:
        low = f.lower()
        if all(n in low for n in needles):
            return f
    return None


def parse_approved_employers(fp) -> list[str]:
    """CSV(파일객체)에서 승인 이력(initial+continuing approval 합 >= 1) 있는 고용주명 목록.

    연도별 헤더 변형에 견디도록 컬럼명을 부분일치로 탐지한다.
    """
    reader = csv.DictReader(fp)
    fields = reader.fieldnames or []
    name_col = _find_col(fields, "employer") or _find_col(fields, "petitioner")
    init_col = _find_col(fields, "initial", "approval")
    cont_col = _find_col(fields, "continuing", "approval")
    if not name_col:
        raise SystemExit(f"고용주명 컬럼을 못 찾음. 헤더: {fields}")

    def _num(row, col):
        if not col:
            return 0
        raw = (row.get(col) or "0").replace(",", "").strip()
        try:
            return int(float(raw))
        except ValueError:
            return 0

    out = []
    for row in reader:
        approvals = _num(row, init_col) + _num(row, cont_col)
        if approvals >= 1:
            name = (row.get(name_col) or "").strip()
            if name:
                out.append(name)
    return out


def main():
    if len(sys.argv) < 2:
        raise SystemExit("사용: python scripts/verify_h1b_sponsors.py /path/to/h1b_datahub.csv")
    with open(sys.argv[1], newline="", encoding="utf-8", errors="replace") as f:
        employers = parse_approved_employers(f)

    with open(REGISTRY_PATH, encoding="utf-8") as f:
        data = json.load(f)
    cos = {k: v for k, v in data.items() if not k.startswith("_")}

    emp_index: dict[str, str] = {}
    for e in employers:
        emp_index.setdefault(normalize(e), e)

    hits = []
    for name, info in cos.items():
        matched = None
        for brand in {name, info.get("token", "")}:
            for e in emp_index.values():
                if match_company(brand, e):
                    matched = e
                    break
            if matched:
                break
        if matched:
            hits.append((name, info.get("ats"), matched, info.get("h1b_sponsor") is True))

    print(f"=== H-1B 매칭 후보: {len(hits)}/{len(cos)} (검토 후 companies.json 반영) ===")
    for name, ats, emp, already in sorted(hits):
        flag = " [이미 플래그됨]" if already else ""
        print(f"  {name:<16} [{ats}] -> {emp}{flag}")


if __name__ == "__main__":
    main()
