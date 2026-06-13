from app.etl.transform import clean_structured_html, html_strip


def test_html_strip_decodes_entities():
    assert html_strip("Pay Range $244,000 &mdash; $305,000 USD") == "Pay Range $244,000 — $305,000 USD"
    assert html_strip("<p>x &amp; y &nbsp; z</p>") == "x & y z"


def test_html_strip_removes_tags():
    assert html_strip("<b>Hello</b> world") == "Hello world"


def test_clean_structured_preserves_structure_tags():
    out = clean_structured_html(
        '<div class="content-intro"><p>We are <strong>hiring</strong>.</p></div>'
        '<h2 class="y">What you do</h2><ul><li>Build</li><li>Ship</li></ul>'
    )
    for tag in ("<p>", "<h2>", "<ul>", "<li>", "<strong>"):
        assert tag in out, f"{tag} 보존돼야 함: {out}"
    assert "class=" not in out and "<div" not in out  # 래퍼/속성 제거


def test_clean_structured_strips_unsafe_and_attrs():
    out = clean_structured_html('<p style="x">a</p><script>bad()</script><a href="/x" target="_blank">link</a>')
    assert "<script" not in out and "bad()" not in out
    assert "style=" not in out and "href=" not in out
    assert "<a>link</a>" in out  # a 태그는 유지하되 속성 제거


def test_clean_structured_trims_boilerplate():
    out = clean_structured_html("<p>Real content.</p><p>We are an equal opportunity employer.</p>")
    assert "Real content" in out
    assert "equal opportunity" not in out  # 보일러플레이트 문단 제거


def test_clean_structured_plain_text_passthrough():
    assert clean_structured_html("plain text, no tags") == "plain text, no tags"
    assert clean_structured_html("") == ""
