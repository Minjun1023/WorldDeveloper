import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
import sponsor_match as sm
import verify_h1b_sponsors as v
for _n in ('normalize', 'match_company', 'company_names'):
    if not hasattr(v, _n) and hasattr(sm, _n): setattr(v, _n, getattr(sm, _n))

CSV = (
    "Fiscal Year,Employer (Petitioner) Name,Initial Approval,Initial Denial,"
    "Continuing Approval,Continuing Denial,Petitioner City,Petitioner State\n"
    "2024,STRIPE INC,12,0,8,1,SOUTH SAN FRANCISCO,CA\n"
    "2024,SOME RANDOM LLC,0,3,0,0,AUSTIN,TX\n"
    "2024,DATABRICKS INC,40,2,15,0,SAN FRANCISCO,CA\n"
)


def test_parse_approved_employers_filters_zero_approvals():
    # 반환은 (고용주명, 위치) 튜플 — 승인 0건(SOME RANDOM LLC)은 제외된다.
    emps = v.parse_approved_employers(io.StringIO(CSV))
    names = {name.lower() for name, _loc in emps}
    assert any("stripe" in n for n in names)
    assert any("databricks" in n for n in names)
    assert not any("some random" in n for n in names)


def test_reuses_uk_matchers():
    assert v.match_company("stripe", "STRIPE INC") is True
    assert v.match_company("databricks", "DATABRICKS INC") is True
    assert v.match_company("monzo", "Some Random LLC") is False
