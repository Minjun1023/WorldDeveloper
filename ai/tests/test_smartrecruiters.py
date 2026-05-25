from dev_jobs_core.sources import smartrecruiters as sr

LIST_PAYLOAD = {
    "offset": 0, "limit": 100, "totalFound": 1,
    "content": [
        {
            "id": "744000122509268",
            "name": "Sr. SW Engineer",
            "company": {"identifier": "Visa", "name": "Visa"},
            "releasedDate": "2026-04-23T16:54:54.835Z",
            "location": {"city": "Austin", "region": "TX", "country": "us",
                         "remote": False, "fullLocation": "Austin, TX, United States"},
            "typeOfEmployment": {"label": "Full-time"},
            "ref": "https://api.smartrecruiters.com/v1/companies/Visa/postings/744000122509268",
        },
        {"name": "no id — skipped"},
    ],
}

DETAIL_PAYLOAD = {
    "id": "744000122509268",
    "applyUrl": "https://jobs.smartrecruiters.com/Visa/744000122509268-sr-sw-engineer",
    "postingUrl": "https://jobs.smartrecruiters.com/Visa/744000122509268",
    "jobAd": {"sections": {
        "jobDescription": {"title": "Job Description", "text": "<p>Design and build systems.</p>"},
        "qualifications": {"title": "Qualifications", "text": "<p>5+ years.</p>"},
    }},
}


def test_parse_list_returns_content():
    assert len(sr._parse_list(LIST_PAYLOAD)) == 2
    assert sr._parse_list({}) == []


def test_to_posting_maps_fields_with_detail():
    item = LIST_PAYLOAD["content"][0]
    p = sr._to_posting("Visa", item, DETAIL_PAYLOAD)
    assert p is not None
    assert p.job_id == "smartrecruiters:Visa:744000122509268"
    assert p.source == "smartrecruiters"
    assert p.title == "Sr. SW Engineer"
    assert p.company == "Visa"
    assert p.location == "Austin, TX, United States"
    assert p.is_remote is False
    assert p.employment_type == "Full-time"
    assert "Design and build" in p.description
    assert "5+ years" in p.description
    assert p.apply_url == "https://jobs.smartrecruiters.com/Visa/744000122509268-sr-sw-engineer"
    assert p.posted_at == "2026-04-23T16:54:54.835Z"


def test_to_posting_skips_without_id():
    assert sr._to_posting("Visa", {"name": "x"}, None) is None


def test_to_posting_detail_none_falls_back_apply_url():
    item = LIST_PAYLOAD["content"][0]
    p = sr._to_posting("Visa", item, None)
    assert p.description == ""
    assert p.apply_url == "https://jobs.smartrecruiters.com/Visa/744000122509268"
