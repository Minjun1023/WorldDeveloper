import importlib.util
import pathlib

import pytest

# transformers 미설치 환경에서는 스킵
pytest.importorskip("transformers")

_spec = importlib.util.spec_from_file_location(
    "train_visa_tagger",
    pathlib.Path(__file__).parent.parent / "scripts" / "train_visa_tagger.py",
)


def test_alignment_tags_subwords_in_span():
    from transformers import AutoTokenizer

    mod = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(mod)
    tok = AutoTokenizer.from_pretrained("xlm-roberta-base")
    text = "We can sponsor visas for engineers."
    span_start = text.index("sponsor")
    span_end = text.index("visas") + len("visas")
    spans = [{"start": span_start, "end": span_end, "label": "VISA_POS"}]
    enc = mod.char_spans_to_token_labels(text, spans, tok)
    tagged = [lab for lab in enc["labels"] if lab not in (-100, 0)]
    assert len(tagged) >= 1  # span 토큰이 B/I-VISA_POS 로 태깅됨
