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


def test_parse_detail_extracts_title_body_location():
    d = hrmos._parse_detail(DETAIL_HTML)
    assert d["title"] == "ソフトウェアエンジニア（バックエンド）"
    # 첫 pg-descriptions(求人内容)만 본문으로 — 会社情報 텍스트는 제외
    assert "Kubernetes" in d["description"]
    assert "決済基盤を開発" in d["description"]
    assert "応募資格" in d["description"]
    assert "会社情報の説明文" not in d["description"]
    assert d["location"] == "東京都渋谷区"
