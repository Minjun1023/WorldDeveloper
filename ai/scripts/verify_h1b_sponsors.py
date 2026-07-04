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

# 공유 매칭 모듈(이름 + 위치 disambiguation + confidence). UK/IND 와 동일.
from sponsor_match import company_names, find_candidates

REGISTRY_PATH = Path(__file__).parent.parent / "dev_jobs_core" / "data" / "companies.json"


def _find_col(fieldnames: list[str], *needles: str) -> str | None:
    for f in fieldnames:
        low = f.lower()
        if all(n in low for n in needles):
            return f
    return None


def parse_approved_employers(fp) -> list[tuple[str, str]]:
    """CSV(파일객체)에서 승인 이력(initial+continuing approval 합 >= 1) 있는 (고용주명, 위치).

    연도별 헤더 변형에 견디도록 컬럼명을 부분일치로 탐지한다. 위치=City + State.
    """
    reader = csv.DictReader(fp)
    fields = reader.fieldnames or []
    name_col = _find_col(fields, "employer") or _find_col(fields, "petitioner")
    init_col = _find_col(fields, "initial", "approval")
    cont_col = _find_col(fields, "continuing", "approval")
    city_col = _find_col(fields, "city")
    state_col = _find_col(fields, "state")
    if not name_col:
        raise SystemExit(f"고용주명 컬럼을 못 찾음. 헤더: {fields}")
    if not init_col and not cont_col:
        print("경고: 승인(approval) 컬럼을 못 찾음 → 모든 고용주 제외됨."
              f" 헤더: {fields}", file=sys.stderr)

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
                loc = " ".join(
                    (row.get(c) or "").strip() for c in (city_col, state_col) if c
                ).strip()
                out.append((name, loc))
    return out


def main():
    if len(sys.argv) < 2:
        raise SystemExit("사용: python scripts/verify_h1b_sponsors.py /path/to/h1b_datahub.csv")
    with open(sys.argv[1], newline="", encoding="utf-8", errors="replace") as f:
        register = parse_approved_employers(f)

    with open(REGISTRY_PATH, encoding="utf-8") as f:
        data = json.load(f)
    cos = {k: v for k, v in data.items() if not k.startswith("_")}

    hits = []
    for name, info in cos.items():
        cands = find_candidates(company_names(name, info), info.get("hq"), register)
        if cands:
            hits.append((name, info, cands[0]))

    print(f"=== H-1B 매칭 후보: {len(hits)}/{len(cos)} (검토 후 companies.json 반영) ===")
    print("    confidence: high=이름+위치일치 / medium=단독 이름일치 / low=동명 모호(검토 필수)")
    for name, info, c in sorted(hits, key=lambda h: ({"high": 0, "medium": 1, "low": 2}[h[2].confidence], h[0])):
        already = " [이미 플래그됨]" if info.get("h1b_sponsor") is True else ""
        dom = f" <{info['domain']}>" if info.get("domain") else ""
        loc = f" @{c.loc}" if c.loc else ""
        print(f"  [{c.confidence:<6}] {name:<16}{dom} [{info.get('ats')}] -> {c.org}{loc}{already}")


if __name__ == "__main__":
    main()
