from pathlib import Path

from dev_jobs_core.sources import hrmos

FIX = Path(__file__).parent / "fixtures"
LIST_HTML = (FIX / "hrmos_list.html").read_text(encoding="utf-8")
DETAIL_HTML = (FIX / "hrmos_detail.html").read_text(encoding="utf-8")


def test_parse_list_extracts_id_and_title():
    rows = hrmos._parse_list(LIST_HTML)
    assert rows == [
        ("1001", "ソフトウェアエンジニア（バックエンド）"),
        ("1002", "機械学習エンジニア"),
        ("1003", "営業マネージャー"),
    ]
