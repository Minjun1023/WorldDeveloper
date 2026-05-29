from dev_jobs_core.sources import personio

XML_WITH_BODY = """<?xml version="1.0" encoding="UTF-8"?>
<workzag-jobs>
  <position>
    <id>1834171</id>
    <subcompany>Personio SE &amp; Co. KG</subcompany>
    <office>Munich</office>
    <additionalOffices><office>Berlin</office></additionalOffices>
    <department>Product and Tech</department>
    <recruitingCategory>Engineering</recruitingCategory>
    <name>Staff Software Engineer, Data Platform</name>
    <jobDescriptions>
      <jobDescription><name>Tasks</name><value><![CDATA[Design and build systems.]]></value></jobDescription>
      <jobDescription><name>Requirements</name><value><![CDATA[7+ years.]]></value></jobDescription>
    </jobDescriptions>
    <employmentType>permanent</employmentType>
    <createdAt>2024-11-13T14:10:41+00:00</createdAt>
  </position>
  <position>
    <name>no id — skipped</name>
  </position>
</workzag-jobs>"""

XML_EMPTY_DESC = """<?xml version="1.0" encoding="UTF-8"?>
<workzag-jobs>
  <position>
    <id>42</id>
    <office>Amsterdam</office>
    <name>Backend Engineer</name>
    <jobDescriptions></jobDescriptions>
    <employmentType>permanent</employmentType>
    <createdAt>2026-01-02T00:00:00+00:00</createdAt>
  </position>
</workzag-jobs>"""


def test_parse_positions_returns_all_positions():
    assert len(personio._parse_positions(XML_WITH_BODY)) == 2
    assert personio._parse_positions("") == []
    assert personio._parse_positions("not xml <<<") == []


def test_to_posting_maps_fields():
    pos = personio._parse_positions(XML_WITH_BODY)[0]
    p = personio._to_posting("acme", pos)
    assert p is not None
    assert p.job_id == "personio:acme:1834171"
    assert p.source == "personio"
    assert p.title == "Staff Software Engineer, Data Platform"
    assert p.company == "Personio SE & Co. KG"
    assert p.location == "Munich, Berlin"
    assert p.employment_type == "permanent"
    assert "Design and build systems." in p.description
    assert "7+ years." in p.description
    assert p.apply_url == "https://acme.jobs.personio.com/job/1834171"
    assert p.posted_at == "2024-11-13T14:10:41+00:00"


def test_to_posting_skips_without_id():
    pos = personio._parse_positions(XML_WITH_BODY)[1]
    assert personio._to_posting("acme", pos) is None


def test_to_posting_company_falls_back_to_token():
    pos = personio._parse_positions(XML_EMPTY_DESC)[0]
    p = personio._to_posting("mollie", pos)
    assert p.company == "mollie"
    assert p.location == "Amsterdam"
    assert p.description == ""
