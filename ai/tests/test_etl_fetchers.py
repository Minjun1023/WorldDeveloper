from app.etl.jobs import ATS_FETCHERS
from dev_jobs_core.sources import personio


def test_personio_registered_in_ats_fetchers():
    assert "personio" in ATS_FETCHERS
    assert ATS_FETCHERS["personio"] is personio.fetch


def test_all_ats_fetchers_are_callable():
    for name, fn in ATS_FETCHERS.items():
        assert callable(fn), f"{name} fetcher is not callable"
