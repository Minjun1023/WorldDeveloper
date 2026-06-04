import dev_jobs_core.analyzers.visa_tagger as vt
from app.config import settings


def _reset():
    vt._pipe = None
    vt._load_failed = False


def test_unavailable_when_model_unset(monkeypatch):
    _reset()
    monkeypatch.setattr(settings, "visa_tagger_model", "")
    assert vt.tag_spans("we sponsor visas") is None
    assert vt.is_available() is False


def test_tag_spans_maps_entities_and_filters_by_score(monkeypatch):
    _reset()
    monkeypatch.setattr(settings, "visa_tagger_model", "dummy/model")
    monkeypatch.setattr(settings, "visa_tagger_min_confidence", 0.5)

    def fake_pipe(text):
        return [
            {"entity_group": "VISA_POS", "word": "visa sponsorship", "score": 0.91},
            {"entity_group": "VISA_NEG", "word": "low conf", "score": 0.2},
            {"entity_group": "MISC", "word": "ignore me", "score": 0.99},
        ]

    monkeypatch.setattr(vt, "_load", lambda: fake_pipe)
    spans = vt.tag_spans("...")
    assert spans is not None
    assert [(s.label, s.text) for s in spans] == [("VISA_POS", "visa sponsorship")]
