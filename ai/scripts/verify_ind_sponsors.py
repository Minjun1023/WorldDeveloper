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

# 공유 매칭 모듈(이름 + 위치 disambiguation + confidence). UK/H-1B 와 동일.
from sponsor_match import company_names, find_candidates

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
    # IND 명부는 위치 컬럼이 없어 위치는 빈 값(동명 시 low 로만 구분, 가점 없음).
    register = [(o, "") for o in orgs]

    with open(REGISTRY_PATH, encoding="utf-8") as f:
        data = json.load(f)
    cos = {k: v for k, v in data.items() if not k.startswith("_")}

    hits = []
    for name, info in cos.items():
        cands = find_candidates(company_names(name, info), info.get("hq"), register)
        if cands:
            hits.append((name, info, cands[0]))

    print(f"=== IND 매칭 후보: {len(hits)}/{len(cos)} (검토 후 companies.json 반영) ===")
    print("    confidence: medium=단독 이름일치 / low=동명 모호(검토 필수). IND 명부엔 위치 없음.")
    for name, info, c in sorted(hits, key=lambda h: ({"high": 0, "medium": 1, "low": 2}[h[2].confidence], h[0])):
        already = " [이미 플래그됨]" if info.get("ind_sponsor") is True else ""
        dom = f" <{info['domain']}>" if info.get("domain") else ""
        print(f"  [{c.confidence:<6}] {name:<16}{dom} [{info.get('ats')}] -> {c.org}{already}")


if __name__ == "__main__":
    main()
