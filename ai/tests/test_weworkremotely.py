from dev_jobs_core.sources import weworkremotely as wwr

SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>Acme Corp: Senior Backend Engineer</title>
    <link>https://weworkremotely.com/remote-jobs/acme-senior-backend</link>
    <guid>https://weworkremotely.com/remote-jobs/acme-senior-backend</guid>
    <description>Great remote role.</description>
    <pubDate>Tue, 20 May 2026 10:00:00 +0000</pubDate>
  </item>
  <item>
    <title>NoCompanyTitle Only</title>
    <link>https://weworkremotely.com/remote-jobs/x</link>
    <guid>wwr-x</guid>
  </item>
</channel></rss>"""


def test_parse_rss_maps_fields():
    out = wwr._parse_rss(SAMPLE_RSS)
    assert len(out) == 2
    p = out[0]
    # job_id native 부분은 URL 슬러그(슬래시 없음) — path segment 로 안전해야 함.
    assert p.job_id == "wwr:acme-senior-backend"
    assert p.source == "wwr"
    assert p.company == "Acme Corp"
    assert p.title == "Senior Backend Engineer"
    assert p.is_remote is True
    assert p.location == "Remote"
    # apply_url 은 원본 전체 URL 그대로 보존.
    assert p.apply_url == "https://weworkremotely.com/remote-jobs/acme-senior-backend"


def test_parse_rss_title_without_company():
    out = wwr._parse_rss(SAMPLE_RSS)
    assert out[1].company == ""
    assert out[1].title == "NoCompanyTitle Only"


def test_parse_rss_job_id_is_path_safe():
    # job_id 는 /api/v1/jobs/{id} 의 단일 path segment 로 쓰이므로 슬래시가 없어야 한다.
    # (슬래시가 들어가면 Spring Security StrictHttpFirewall 이 // 를 400 으로 거부)
    out = wwr._parse_rss(SAMPLE_RSS)
    for p in out:
        assert "/" not in p.job_id, f"job_id 에 슬래시 포함: {p.job_id}"
