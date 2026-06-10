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


def test_to_posting_marks_remote_from_english_location():
    p = hrmos._to_posting("acme", "1", "t", {"title": "t", "description": "", "location": "Remote (Tokyo)"})
    assert p.is_remote is True


def test_section_text_handles_unclosed_p_and_section_container():
    # 실제 HRMOS 는 <section class="pg-descriptions"> 를 쓰고, SSR 은 <p> 를 안 닫기도 한다.
    # 닫히지 않은 <p> 가 있어도 첫 섹션 텍스트만 잡고 다음 섹션/footer 는 제외해야 한다.
    html = (
        '<section class="pg-descriptions"><p>本文A<p>本文B</section>'
        '<section class="pg-descriptions"><p>会社情報の説明文</section>'
        '<footer>FOOTER</footer>'
    )
    assert hrmos._section_text(html, "pg-descriptions") == "本文A本文B"


def test_parse_detail_works_with_section_container():
    html = (
        '<h1 class="sg-corporate-name">バックエンドエンジニア</h1>'
        '<section class="pg-descriptions"><div class="pg-body"><p>Go で開発</p></div></section>'
        '<p class="pg-location-address">東京都渋谷区</p>'
    )
    d = hrmos._parse_detail(html)
    assert d["title"] == "バックエンドエンジニア"
    assert "Go で開発" in d["description"]
    assert d["location"] == "東京都渋谷区"


def test_parse_list_robust_to_attrs_and_nesting():
    # <li> 에 추가 속성, <a> 에 추가 속성, h2 뒤 중첩 <ul><li> 가 있어도 정확히 추출
    html = (
        '<ul>'
        '<li id="x" data-k="v" class="pg-list-cassette jsc-joblist-cassette foo">'
        '<a class="c" href="https://hrmos.co/pages/acme/jobs/2001" data-id="2001">'
        '<div class="pg-list-cassette-detail"><h2>バックエンドエンジニア</h2>'
        '<ul><li>Go</li><li>Kubernetes</li></ul>'
        '</div></a></li>'
        '</ul>'
    )
    assert hrmos._parse_list(html) == [("2001", "バックエンドエンジニア")]
