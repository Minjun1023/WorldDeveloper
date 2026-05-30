import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
import verify_h1b_sponsors as v

CSV = (
    "Fiscal Year,Employer (Petitioner) Name,Initial Approval,Initial Denial,"
    "Continuing Approval,Continuing Denial,Petitioner City,Petitioner State\n"
    "2024,STRIPE INC,12,0,8,1,SOUTH SAN FRANCISCO,CA\n"
    "2024,SOME RANDOM LLC,0,3,0,0,AUSTIN,TX\n"
    "2024,DATABRICKS INC,40,2,15,0,SAN FRANCISCO,CA\n"
)


def test_parse_approved_employers_filters_zero_approvals():
    emps = v.parse_approved_employers(io.StringIO(CSV))
    names = {e.lower() for e in emps}
    assert any("stripe" in n for n in names)
    assert any("databricks" in n for n in names)
    assert not any("some random" in n for n in names)


def test_reuses_uk_matchers():
    assert v.match_company("stripe", "STRIPE INC") is True
    assert v.match_company("databricks", "DATABRICKS INC") is True
    assert v.match_company("monzo", "Some Random LLC") is False
