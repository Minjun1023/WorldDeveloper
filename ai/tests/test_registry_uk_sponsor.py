from dev_jobs_core import registry


def test_uk_sponsor_slugs_returns_only_flagged(monkeypatch):
    fake = {
        "monzo": {"ats": "greenhouse", "token": "monzo", "uk_sponsor": True},
        "acme": {"ats": "lever", "token": "acme"},                 # 플래그 없음
        "beta": {"ats": "ashby", "token": "beta", "uk_sponsor": False},
        "_meta": {"description": "x"},
    }
    monkeypatch.setattr(registry, "_load", lambda: {k: v for k, v in fake.items() if not k.startswith("_")})
    slugs = registry.uk_sponsor_slugs()
    assert slugs == {"monzo"}


def test_uk_sponsor_slugs_real_registry_is_set():
    assert isinstance(registry.uk_sponsor_slugs(), set)
