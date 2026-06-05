import dev_jobs_core.recommender.reranker as rr


def _reset():
    rr._model = None
    rr._load_failed = False


def test_unavailable_returns_empty(monkeypatch):
    _reset()
    monkeypatch.setattr(rr, "_load_model", lambda: None)
    assert rr.is_available() is False
    assert rr.rerank("query", ["doc a", "doc b"]) == []


def test_empty_docs_returns_empty(monkeypatch):
    _reset()
    called = {"n": 0}

    class Fake:
        def predict(self, pairs):
            called["n"] += 1
            return [0.0] * len(pairs)

    monkeypatch.setattr(rr, "_load_model", lambda: Fake())
    assert rr.rerank("q", []) == []
    assert called["n"] == 0


def test_rerank_builds_pairs_and_returns_scores(monkeypatch):
    _reset()
    seen = {}

    class Fake:
        def predict(self, pairs):
            seen["pairs"] = pairs
            return [0.1, 0.9]

    monkeypatch.setattr(rr, "_load_model", lambda: Fake())
    out = rr.rerank("Q", ["A", "B"])
    assert out == [0.1, 0.9]
    assert seen["pairs"] == [("Q", "A"), ("Q", "B")]


def test_truncates_inputs_to_max_chars(monkeypatch):
    _reset()
    seen = {}

    class Fake:
        def predict(self, pairs):
            seen["pairs"] = pairs
            return [0.5]

    monkeypatch.setattr(rr, "_load_model", lambda: Fake())
    rr.rerank("Q" * 3000, ["D" * 3000])
    q, d = seen["pairs"][0]
    assert len(q) == rr._MAX_CHARS
    assert len(d) == rr._MAX_CHARS


def test_single_doc_scalar_score(monkeypatch):
    _reset()

    class Fake:
        def predict(self, pairs):
            return 0.7  # CrossEncoder returns a bare scalar for a single pair

    monkeypatch.setattr(rr, "_load_model", lambda: Fake())
    assert rr.rerank("Q", ["only one"]) == [0.7]
