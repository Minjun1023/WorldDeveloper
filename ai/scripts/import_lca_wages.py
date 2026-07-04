"""미 노동부 LCA 공시(H-1B 신고 연봉) → 회사별 소프트웨어 직군 연봉 통계 적재.

입력: /tmp/lca/*.xlsx (DOL LCA Disclosure Data, 분기별)
집계: CASE_STATUS=Certified + SOC 15-*(컴퓨터/수학 직군)만.
      회사 매칭은 sponsor_match(normalize/match_company/company_names) 재사용 —
      명부검증과 동일한 보수 규칙(정확/첫토큰 접두)이라 오탐 정책이 일관된다.
저장: company_h1b_wages (표본 5건 미만은 대표성이 없어 제외).

사용: DATABASE_URL=... uv run python scripts/import_lca_wages.py /tmp/lca/*.xlsx
"""
from __future__ import annotations

import json
import os
import statistics
import sys
from pathlib import Path

import openpyxl
import psycopg

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))
from sponsor_match import match_company, normalize  # noqa: E402
from app.etl.transform import slugify  # noqa: E402

DSN = os.environ.get("DATABASE_URL", "postgresql://devjobs:devjobs@localhost:5432/devjobs")
DATA = Path(__file__).parent.parent / "dev_jobs_core" / "data" / "companies.json"

# 연 환산 계수 (WAGE_UNIT_OF_PAY)
_UNIT = {"year": 1, "hour": 2080, "week": 52, "month": 12, "bi-weekly": 26, "biweekly": 26}
MIN_CASES = 5
# 연환산 후 상식 범위 밖(입력 오류/파트타임 잡음) 제거
WAGE_MIN, WAGE_MAX = 40_000, 1_500_000


def load_companies() -> dict[str, list[str]]:
    """slug → 매칭용 이름 변형(원 이름 + token + aliases)."""
    data = json.loads(DATA.read_text())
    out: dict[str, list[str]] = {}
    for name, info in data.items():
        if name == "_meta" or not isinstance(info, dict):
            continue
        variants = {name, info.get("token", "")} | set(info.get("aliases") or [])
        out[slugify(name)] = [v for v in variants if v]
    return out


def annual(from_wage, unit) -> float | None:
    try:
        w = float(from_wage)
    except (TypeError, ValueError):
        return None
    mult = _UNIT.get(str(unit or "").strip().lower())
    if not mult:
        return None
    w *= mult
    return w if WAGE_MIN <= w <= WAGE_MAX else None


def scan(path: str, companies: dict[str, list[str]],
         cache: dict[str, str | None], wages: dict[str, list[float]]) -> tuple[int, int]:
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [str(h or "").strip().upper() for h in next(rows)]
    idx = {h: i for i, h in enumerate(header)}
    c_status, c_emp = idx["CASE_STATUS"], idx["EMPLOYER_NAME"]
    c_soc, c_from, c_unit = idx["SOC_CODE"], idx["WAGE_RATE_OF_PAY_FROM"], idx["WAGE_UNIT_OF_PAY"]

    total = matched = 0
    for r in rows:
        total += 1
        if str(r[c_status] or "").strip() != "Certified":
            continue
        if not str(r[c_soc] or "").startswith("15-"):  # 컴퓨터/수학 직군만
            continue
        emp = str(r[c_emp] or "")
        norm = normalize(emp)
        if not norm:
            continue
        if norm not in cache:  # 유니크 고용주명당 1회만 165사 대조
            cache[norm] = next(
                (slug for slug, names in companies.items()
                 if any(match_company(v, emp) for v in names)),
                None,
            )
        slug = cache[norm]
        if not slug:
            continue
        w = annual(r[c_from], r[c_unit])
        if w is None:
            continue
        wages.setdefault(slug, []).append(w)
        matched += 1
    wb.close()
    return total, matched


def main() -> None:
    files = sys.argv[1:] or sorted(str(p) for p in Path("/tmp/lca").glob("*.xlsx"))
    companies = load_companies()
    print(f"회사 {len(companies)}개 로드, 파일 {len(files)}개")

    cache: dict[str, str | None] = {}
    wages: dict[str, list[float]] = {}
    for f in files:
        total, matched = scan(f, companies, cache, wages)
        print(f"  {Path(f).name}: {total:,}행 중 매칭 {matched:,}건")

    period = " + ".join(Path(f).stem.replace("LCA_Disclosure_Data_", "") for f in files)
    rows = []
    for slug, ws_ in wages.items():
        if len(ws_) < MIN_CASES:
            continue
        ws_.sort()
        q = statistics.quantiles(ws_, n=4)
        rows.append((slug, len(ws_), int(statistics.median(ws_)), int(q[0]), int(q[2]), period))

    with psycopg.connect(DSN) as conn:
        for row in rows:
            conn.execute(
                """
                INSERT INTO company_h1b_wages (company_slug, cases, median_wage, p25_wage, p75_wage, period)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_slug) DO UPDATE SET
                    cases = EXCLUDED.cases, median_wage = EXCLUDED.median_wage,
                    p25_wage = EXCLUDED.p25_wage, p75_wage = EXCLUDED.p75_wage,
                    period = EXCLUDED.period, updated_at = now()
                """,
                row,
            )
        conn.commit()
    print(f"저장: {len(rows)}개 회사 (표본 {MIN_CASES}건 미만 제외)")
    for slug, n, med, p25, p75, _ in sorted(rows, key=lambda x: -x[2])[:10]:
        print(f"  {slug}: 중앙값 ${med:,} (p25 ${p25:,} ~ p75 ${p75:,}, n={n})")


if __name__ == "__main__":
    main()
