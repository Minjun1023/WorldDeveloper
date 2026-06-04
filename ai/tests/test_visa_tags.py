from dev_jobs_core.analyzers.visa_tags import (
    LABELS,
    Span,
    find_evidence_span,
    spans_to_status,
)


def test_labels_bio_scheme():
    assert LABELS == ["O", "B-VISA_POS", "I-VISA_POS", "B-VISA_NEG", "I-VISA_NEG"]


def test_pos_span_yields_sponsors_with_evidence():
    spans = [Span("VISA_POS", "we sponsor visas", 0.9)]
    assert spans_to_status(spans) == ("sponsors", ["we sponsor visas"])


def test_neg_span_yields_no_sponsor():
    spans = [Span("VISA_NEG", "must have right to work", 0.8)]
    assert spans_to_status(spans) == ("no_sponsor", ["must have right to work"])


def test_both_present_prefers_pos():
    spans = [Span("VISA_NEG", "right to work", 0.95), Span("VISA_POS", "visa sponsorship", 0.6)]
    assert spans_to_status(spans) == ("sponsors", ["visa sponsorship"])


def test_no_spans_is_unclear():
    assert spans_to_status([]) == ("unclear", [])


def test_picks_highest_score_evidence():
    spans = [Span("VISA_POS", "low", 0.5), Span("VISA_POS", "high", 0.9)]
    assert spans_to_status(spans) == ("sponsors", ["high"])


def test_find_evidence_span_normalizes_whitespace_and_case():
    text = "We are great.  We can SPONSOR   visas for you."
    span = find_evidence_span(text, "we can sponsor visas")
    assert span is not None
    start, end = span
    assert text[start:end].lower().startswith("we can sponsor")


def test_find_evidence_span_returns_none_when_absent():
    assert find_evidence_span("no relevant text here", "we sponsor visas") is None
