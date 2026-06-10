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


def test_to_posting_maps_fields():
    detail = {
        "title": "ソフトウェアエンジニア（バックエンド）",
        "description": "Go と Kubernetes で決済基盤を開発します。",
        "location": "東京都渋谷区",
    }
    p = hrmos._to_posting("cyberagent-group", "1001", "list title", detail)
    assert p.job_id == "hrmos:cyberagent-group:1001"
    assert p.source == "hrmos"
    assert p.title == "ソフトウェアエンジニア（バックエンド）"
    assert p.company == "Cyberagent Group"
    assert p.location == "東京都渋谷区"
    assert p.is_remote is False
    assert p.employment_type == "FULLTIME"
    assert "決済基盤を開発" in p.description
    assert p.apply_url == "https://hrmos.co/pages/cyberagent-group/jobs/1001"


def test_to_posting_falls_back_to_list_title():
    p = hrmos._to_posting("acme", "9", "目録タイトル", {"title": "", "description": "x", "location": ""})
    assert p.title == "目録タイトル"


def test_to_posting_marks_remote_from_location():
    p = hrmos._to_posting("acme", "9", "t", {"title": "t", "description": "", "location": "フルリモート"})
    assert p.is_remote is True
