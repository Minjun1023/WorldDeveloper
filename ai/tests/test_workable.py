from dev_jobs_core.sources import workable as wk

ITEM = {
    "title": "Senior Backend Engineer",
    "shortcode": "ABC123",
    "employment_type": "Full",
    "telecommuting": False,
    "url": "https://apply.workable.com/zego/j/ABC123/",
    "application_url": "https://apply.workable.com/zego/j/ABC123/apply/",
    "published_on": "2026-05-01",
    "country": "United Kingdom",
    "city": "London",
    "state": "",
    "description": "<p>Build <b>distributed</b> systems.</p>",
}


def test_to_posting_maps_fields():
    p = wk._to_posting("zego", "Zego", ITEM)
    assert p is not None
    assert p.job_id == "workable:zego:ABC123"
    assert p.source == "workable"
    assert p.title == "Senior Backend Engineer"
    assert p.company == "Zego"
    assert p.location == "London, United Kingdom"
    assert p.is_remote is False
    assert p.employment_type == "FULLTIME"
    assert "Build distributed systems" in p.description
    assert p.posted_at == "2026-05-01"
    assert p.apply_url.endswith("/zego/j/ABC123/apply/")


def test_telecommuting_marks_remote():
    p = wk._to_posting("acme", "Acme", {**ITEM, "telecommuting": True})
    assert p.is_remote is True


def test_skips_without_id():
    assert wk._to_posting("acme", "Acme", {"title": "x"}) is None


def test_location_falls_back_to_locations_array():
    item = {
        "shortcode": "X1", "title": "Eng",
        "locations": [{"city": "Berlin", "country": "Germany"}],
    }
    p = wk._to_posting("acme", "Acme", item)
    assert p.location == "Berlin, Germany"
