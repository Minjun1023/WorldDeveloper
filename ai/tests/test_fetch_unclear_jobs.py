from app import db


class _FakeResult:
    def __init__(self, rows): self._rows = rows
    def fetchall(self): return self._rows


class _FakeConn:
    def __init__(self, rows): self._rows = rows; self.last_sql = None
    def execute(self, sql, params=None):
        self.last_sql = sql
        return _FakeResult(self._rows)


def test_fetch_unclear_jobs_maps_location_and_is_remote():
    rows = [("job1", "Backend Engineer", "desc text", "monzo", "London, UK", True)]
    conn = _FakeConn(rows)
    out = db.fetch_unclear_jobs(conn)
    assert out == [{
        "id": "job1", "title": "Backend Engineer", "description_text": "desc text",
        "company_slug": "monzo", "location": "London, UK", "is_remote": True,
    }]
    assert "location" in conn.last_sql and "is_remote" in conn.last_sql
