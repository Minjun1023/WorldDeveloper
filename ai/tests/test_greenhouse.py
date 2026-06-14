from dev_jobs_core.sources import greenhouse as gh

# 실제 Greenhouse content 는 HTML 이 엔티티 인코딩돼 옴 (&lt;p&gt;...).
ITEM = {
    "id": 123,
    "title": "Backend Engineer",
    "content": (
        "&lt;p&gt;Build &lt;strong&gt;systems&lt;/strong&gt;.&lt;/p&gt;"
        "&lt;div class=&quot;x&quot;&gt;&lt;ul&gt;&lt;li&gt;Go&lt;/li&gt;&lt;/ul&gt;&lt;/div&gt;"
    ),
    "location": {"name": "Remote - US"},
    "absolute_url": "https://boards.greenhouse.io/acme/jobs/123",
    "updated_at": "2026-05-01T00:00:00Z",
}


def test_decodes_html_entities():
    p = gh._to_posting("acme", ITEM)
    assert p is not None
    assert p.job_id == "greenhouse:acme:123"
    assert p.source == "greenhouse"
    # 엔티티가 디코딩되어 진짜 HTML 태그가 됨 (이스케이프 잔존 없음)
    assert "&lt;" not in p.description
    assert "<p>" in p.description
    assert "<strong>systems</strong>" in p.description
    assert "<li>Go</li>" in p.description


def test_is_remote_from_location():
    p = gh._to_posting("acme", ITEM)
    assert p.is_remote is True
    assert p.location == "Remote - US"


def test_skips_without_id():
    assert gh._to_posting("acme", {"title": "no id"}) is None


def test_decoded_then_cleaned_strips_wrappers_and_attrs():
    # 디코딩된 HTML 을 transform 의 clean_structured_html 로 정리하면
    # 래퍼(div)·속성(class)은 사라지고 허용 태그만 남는다 (torch 불필요한 순수 함수).
    from app.etl.transform import clean_structured_html, html_strip

    p = gh._to_posting("acme", ITEM)
    cleaned = clean_structured_html(p.description)
    assert "<div" not in cleaned.lower()
    assert "class=" not in cleaned
    assert "<p>" in cleaned and "<li>Go</li>" in cleaned
    # 평문화는 태그 없는 깨끗한 텍스트 (태그→공백이라 단어만 검증)
    plain = html_strip(p.description)
    assert "<" not in plain and "&lt;" not in plain
    assert "Build" in plain and "systems" in plain and "Go" in plain
