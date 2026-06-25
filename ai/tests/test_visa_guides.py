"""docs/visa-guides/*.md 파서 — 순수 함수."""
from app.visa_guides import parse_guide_md

SAMPLE = """# United States (us)

## visa_types: H-1B 등 취업비자
source: https://www.uscis.gov/working
retrieved: 2026-06-25

H-1B 는 전문직 취업비자다.
고용주가 청원한다.

## sponsorship: 스폰서십 요건
source: https://www.uscis.gov/sponsor
retrieved: 2026-06-20

회사가 LCA 절차를 밟는다.
"""

def test_parses_sections_with_source_and_date():
    chunks = parse_guide_md("us", SAMPLE)
    assert len(chunks) == 2
    c0 = chunks[0]
    assert c0["country"] == "us"
    assert c0["section"] == "visa_types"
    assert c0["title"] == "H-1B 등 취업비자"
    assert c0["source_url"] == "https://www.uscis.gov/working"
    assert c0["retrieved_at"] == "2026-06-25"
    assert "H-1B 는 전문직 취업비자다." in c0["content"]
    assert "고용주가 청원한다." in c0["content"]
    assert chunks[1]["section"] == "sponsorship"
    assert chunks[1]["retrieved_at"] == "2026-06-20"

def test_ignores_preamble_before_first_section():
    chunks = parse_guide_md("us", "# Title (us)\n\n아무 서문\n\n## visa_types: t\nsource: http://x\nretrieved: 2026-06-25\n\n본문\n")
    assert len(chunks) == 1
    assert chunks[0]["content"].strip() == "본문"
