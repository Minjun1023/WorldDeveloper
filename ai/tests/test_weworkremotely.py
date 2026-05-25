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
    assert p.job_id == "wwr:https://weworkremotely.com/remote-jobs/acme-senior-backend"
    assert p.source == "wwr"
    assert p.company == "Acme Corp"
    assert p.title == "Senior Backend Engineer"
    assert p.is_remote is True
    assert p.location == "Remote"
    assert p.apply_url == "https://weworkremotely.com/remote-jobs/acme-senior-backend"


def test_parse_rss_title_without_company():
    out = wwr._parse_rss(SAMPLE_RSS)
    assert out[1].company == ""
    assert out[1].title == "NoCompanyTitle Only"
