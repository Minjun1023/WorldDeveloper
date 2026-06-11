from app.etl.transform import html_strip


def test_html_strip_decodes_entities():
    assert html_strip("Pay Range $244,000 &mdash; $305,000 USD") == "Pay Range $244,000 — $305,000 USD"
    assert html_strip("<p>x &amp; y &nbsp; z</p>") == "x & y z"


def test_html_strip_removes_tags():
    assert html_strip("<b>Hello</b> world") == "Hello world"
