from dev_jobs_core.sources import adzuna

SAMPLE = {
    "results": [
        {
            "id": "12345",
            "title": "Backend Engineer",
            "company": {"display_name": "Acme GmbH"},
            "location": {"display_name": "Berlin, Germany"},
            "description": "We need a backend engineer.",
            "redirect_url": "https://www.adzuna.de/land/ad/12345",
            "created": "2026-05-20T10:00:00Z",
            "salary_min": 60000.0,
            "salary_max": 90000.0,
        },
        {"title": "no id — skipped"},
    ]
}


def test_parse_results_maps_fields():
    out = adzuna._parse_results("de", SAMPLE)
    assert len(out) == 1
    p = out[0]
    assert p.job_id == "adzuna:de:12345"
    assert p.source == "adzuna"
    assert p.title == "Backend Engineer"
    assert p.company == "Acme GmbH"
    assert p.location == "Berlin, Germany"
    assert p.apply_url == "https://www.adzuna.de/land/ad/12345"
    assert p.salary_min == 60000 and p.salary_max == 90000


def test_disabled_without_keys(monkeypatch):
    monkeypatch.delenv("ADZUNA_APP_ID", raising=False)
    monkeypatch.delenv("ADZUNA_APP_KEY", raising=False)
    assert adzuna.is_enabled() is False


def test_enabled_with_keys(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "x")
    monkeypatch.setenv("ADZUNA_APP_KEY", "y")
    assert adzuna.is_enabled() is True
