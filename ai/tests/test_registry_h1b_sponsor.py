from dev_jobs_core import registry


def test_h1b_sponsor_slugs_returns_only_flagged(monkeypatch):
    fake = {
        "stripe": {"ats": "greenhouse", "token": "stripe", "h1b_sponsor": True},
        "acme": {"ats": "lever", "token": "acme"},
        "beta": {"ats": "ashby", "token": "beta", "h1b_sponsor": False},
        "_meta": {"description": "x"},
    }
    monkeypatch.setattr(registry, "_load", lambda: {k: v for k, v in fake.items() if not k.startswith("_")})
    assert registry.h1b_sponsor_slugs() == {"stripe"}


def test_h1b_sponsor_slugs_real_registry_is_set():
    assert isinstance(registry.h1b_sponsor_slugs(), set)
