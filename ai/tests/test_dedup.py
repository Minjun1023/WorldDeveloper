from dev_jobs_core.dedup import dedup
from dev_jobs_core.models import JobPosting


def _p(job_id, source, company, title, location=""):
    return JobPosting(job_id=job_id, source=source, title=title, company=company, location=location)


def test_exact_job_id_dedup():
    a = _p("adzuna:us:1", "adzuna", "Acme", "Backend Engineer")
    b = _p("adzuna:us:1", "adzuna", "Acme", "Backend Engineer")
    assert len(dedup([a, b])) == 1


def test_cross_source_same_job_prefers_higher_priority():
    adz = _p("adzuna:us:9", "adzuna", "Acme Inc.", "Backend Engineer", "Berlin, Germany")
    gh = _p("greenhouse:acme:5", "greenhouse", "Acme", "Backend Engineer", "Berlin")
    out = dedup([adz, gh])
    assert len(out) == 1
    assert out[0].source == "greenhouse"


def test_different_jobs_kept():
    a = _p("adzuna:us:1", "adzuna", "Acme", "Backend Engineer")
    b = _p("adzuna:us:2", "adzuna", "Acme", "Frontend Engineer")
    assert len(dedup([a, b])) == 2
