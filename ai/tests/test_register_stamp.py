"""register_evidence_updates: 이미 sponsors 인 명부회사 공고에 명부 근거 stamp(순수 함수)."""
from app.etl.visa_reclassify import UK_EVIDENCE, register_evidence_updates


def _uk_loc(loc, remote):
    return (loc or "").lower().find("london") >= 0 or (loc or "").lower().endswith("uk")


def test_stamps_located_job_missing_evidence():
    jobs = [
        {"id": "1", "company_slug": "wise", "location": "London, UK",
         "is_remote": False, "visa_evidence": ["visa sponsorship 문구"]},
    ]
    out = register_evidence_updates(jobs, {"wise"}, _uk_loc, UK_EVIDENCE)
    assert out == {"1": ["visa sponsorship 문구", UK_EVIDENCE]}  # 기존 근거 보존 + append


def test_idempotent_when_evidence_present():
    jobs = [
        {"id": "1", "company_slug": "wise", "location": "London",
         "is_remote": False, "visa_evidence": [UK_EVIDENCE]},
    ]
    assert register_evidence_updates(jobs, {"wise"}, _uk_loc, UK_EVIDENCE) == {}


def test_skips_non_register_company_and_wrong_location():
    jobs = [
        {"id": "1", "company_slug": "acme", "location": "London",  # 명부회사 아님
         "is_remote": False, "visa_evidence": []},
        {"id": "2", "company_slug": "wise", "location": "New York",  # UK 소재 아님
         "is_remote": False, "visa_evidence": []},
    ]
    assert register_evidence_updates(jobs, {"wise"}, _uk_loc, UK_EVIDENCE) == {}
