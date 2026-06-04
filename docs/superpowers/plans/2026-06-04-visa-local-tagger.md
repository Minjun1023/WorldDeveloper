# 비자 분류 로컬 토큰 태깅 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비자 스폰서십 분류의 LLM(gpt-4o-mini) 단계를, 본문에서 근거 스팬을 태깅하는 로컬 파인튜닝 토큰 분류기로 교체하고 OpenAI를 선택 폴백으로 강등한다.

**Architecture:** `reclassify_unclear_visa`의 4단계(키워드→정부명부→LLM→회사추론) 중 3단계만 교체. 신규 `resolve_visa`가 로컬 태거(`xlm-roberta-base` 토큰분류, HF Hub에서 다운로드, CPU 추론)를 먼저 쓰고, abstain/모델부재이고 `OPENAI_API_KEY`가 있을 때만 기존 `classify_visa_llm`로 폴백. 태깅 스팬이 곧 근거(grounding 내장). 학습은 DB 약라벨 → 이식성 스크립트로 무료 GPU/CPU에서 1회.

**Tech Stack:** Python 3.12, FastAPI(`ai/`), PyTorch + HuggingFace `transformers`(토큰분류 파이프라인), `datasets`/`seqeval`/`accelerate`(학습), psycopg(DB), pytest.

---

## 파일 구조

- `ai/dev_jobs_core/analyzers/visa_tags.py` (신규) — 순수 로직: BIO 라벨 상수, `Span`, `spans_to_status`(스팬→상태 도출), `find_evidence_span`(본문에서 근거 문구 char 오프셋 탐색).
- `ai/dev_jobs_core/analyzers/visa_tagger.py` (신규) — transformers 토큰분류 파이프라인 lazy 싱글톤 로드(embeddings.py 패턴) + `tag_spans`. 모델 부재 시 graceful(None).
- `ai/app/etl/visa_local.py` (신규) — `classify_visa_local`(로컬만) + `resolve_visa`(로컬 우선 + 선택 LLM 폴백). reclassify가 호출.
- `ai/app/etl/visa_reclassify.py` (수정) — 3단계 호출부를 `classify_visa_llm` → `resolve_visa`로 교체.
- `ai/app/config.py` (수정) — `visa_tagger_model`, `visa_tagger_min_confidence` 추가.
- `ai/pyproject.toml` (수정) — `transformers`(embeddings extra) + 신규 `train` extra(`datasets`/`seqeval`/`accelerate`).
- `ai/scripts/export_visa_dataset.py` (신규) — DB → BIO char-span JSONL.
- `ai/scripts/train_visa_tagger.py` (신규) — HF Trainer 파인튜닝.
- 테스트: `ai/tests/test_visa_tags.py`, `ai/tests/test_visa_local.py`, `ai/tests/test_visa_tagger.py`.

모든 명령은 `ai/`에서 `uv run`으로 실행한다(예: `cd ai && uv run pytest ...`).

---

### Task 1: BIO 스킴 + 스팬→상태 도출 (순수 로직)

**Files:**
- Create: `ai/dev_jobs_core/analyzers/visa_tags.py`
- Test: `ai/tests/test_visa_tags.py`

- [ ] **Step 1: 실패하는 테스트 작성** — `ai/tests/test_visa_tags.py`

```python
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
```

- [ ] **Step 2: 실패 확인** — Run: `cd ai && uv run --extra dev pytest tests/test_visa_tags.py -v` → FAIL (module not found).

- [ ] **Step 3: 구현** — `ai/dev_jobs_core/analyzers/visa_tags.py`

```python
"""비자 토큰 태깅 — BIO 스킴 + 스팬→상태 도출 (순수 로직, 모델 비의존)."""
from __future__ import annotations

import re
from dataclasses import dataclass

# BIO 5태그. 학습/추론 양쪽이 공유하는 단일 출처.
LABELS = ["O", "B-VISA_POS", "I-VISA_POS", "B-VISA_NEG", "I-VISA_NEG"]
LABEL2ID = {label: i for i, label in enumerate(LABELS)}
ID2LABEL = {i: label for i, label in enumerate(LABELS)}


@dataclass
class Span:
    label: str  # "VISA_POS" | "VISA_NEG"
    text: str
    score: float


def spans_to_status(spans: list[Span]) -> tuple[str, list[str]]:
    """태깅된 스팬으로 비자 상태와 근거를 결정한다.

    POS 우선(스폰서십 필요한 사용자에게 actionable), 동률은 신뢰도 높은 스팬.
    스팬이 곧 근거이므로 grounding 이 내장된다.
    """
    pos = [s for s in spans if s.label == "VISA_POS"]
    if pos:
        best = max(pos, key=lambda s: s.score)
        return "sponsors", [best.text]
    neg = [s for s in spans if s.label == "VISA_NEG"]
    if neg:
        best = max(neg, key=lambda s: s.score)
        return "no_sponsor", [best.text]
    return "unclear", []


def find_evidence_span(text: str, quote: str) -> tuple[int, int] | None:
    """본문에서 근거 문구의 char 오프셋 (start, end) 를 찾는다. 공백/대소문자 무시.

    약라벨 생성용 — LLM/키워드 근거 문구를 본문 원문 위치에 매핑한다. 못 찾으면 None.
    """
    q = re.sub(r"\s+", " ", (quote or "").strip()).lower()
    if len(q) < 6:
        return None
    # 본문을 정규화하되, 정규화 인덱스 → 원문 인덱스 매핑을 유지한다.
    norm_chars: list[str] = []
    norm_to_orig: list[int] = []
    prev_space = False
    for i, ch in enumerate(text):
        if ch.isspace():
            if prev_space:
                continue
            norm_chars.append(" ")
            norm_to_orig.append(i)
            prev_space = True
        else:
            norm_chars.append(ch.lower())
            norm_to_orig.append(i)
            prev_space = False
    norm = "".join(norm_chars)
    idx = norm.find(q)
    if idx < 0:
        return None
    start = norm_to_orig[idx]
    end = norm_to_orig[idx + len(q) - 1] + 1
    return start, end
```

- [ ] **Step 4: 통과 확인** — Run: `cd ai && uv run --extra dev pytest tests/test_visa_tags.py -v` → PASS (7 passed).

- [ ] **Step 5: 커밋**

```bash
git add ai/dev_jobs_core/analyzers/visa_tags.py ai/tests/test_visa_tags.py
git commit -m "feat(ai): visa BIO tag scheme + span->status derivation (pure)"
```

---

### Task 2: 추론 모듈 (transformers 토큰분류, lazy 로드)

**Files:**
- Create: `ai/dev_jobs_core/analyzers/visa_tagger.py`
- Test: `ai/tests/test_visa_tagger.py`

- [ ] **Step 1: 실패하는 테스트 작성** — `ai/tests/test_visa_tagger.py`

```python
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
```

- [ ] **Step 2: 실패 확인** — Run: `cd ai && uv run --extra dev pytest tests/test_visa_tagger.py -v` → FAIL.

- [ ] **Step 3: 구현** — `ai/dev_jobs_core/analyzers/visa_tagger.py`

```python
"""비자 토큰 태깅 추론 — HF transformers token-classification 파이프라인.

embeddings.py 와 동일한 lazy 싱글톤 패턴. settings.visa_tagger_model 미설정이거나
transformers/모델 로드 실패 시 graceful 하게 None 을 반환해 상위(resolve_visa)가 폴백한다.
"""
from __future__ import annotations

import logging

from app.config import settings
from dev_jobs_core.analyzers.visa_tags import Span

log = logging.getLogger(__name__)

_pipe = None
_load_failed = False
_MAX_CHARS = 4000  # 인코더 입력 상한 보호(서브워드 truncation 은 파이프라인이 처리).


def _load():
    """토큰분류 파이프라인을 lazy load. 실패하면 None, 이후 재시도 안 함."""
    global _pipe, _load_failed
    if _pipe is not None:
        return _pipe
    if _load_failed:
        return None
    model_id = settings.visa_tagger_model
    if not model_id:
        _load_failed = True
        return None
    try:
        from transformers import pipeline  # type: ignore

        log.info(f"비자 태깅 모델 로딩: {model_id} (최초 1회)")
        _pipe = pipeline("token-classification", model=model_id, aggregation_strategy="simple")
        return _pipe
    except Exception as e:  # noqa: BLE001 — 어떤 실패든 폴백
        log.warning(f"비자 태깅 모델 로딩 실패: {e}. 로컬 비자 분류 비활성(폴백 사용).")
        _load_failed = True
        return None


def is_available() -> bool:
    return _load() is not None


def tag_spans(text: str, min_score: float | None = None) -> list[Span] | None:
    """본문에서 VISA_POS/VISA_NEG 스팬을 태깅. 모델 부재 시 None(→ 폴백 신호)."""
    pipe = _load()
    if pipe is None:
        return None
    thr = settings.visa_tagger_min_confidence if min_score is None else min_score
    out = pipe(text[:_MAX_CHARS])
    spans: list[Span] = []
    for e in out:
        grp = e.get("entity_group")
        score = float(e.get("score", 0.0))
        if grp in ("VISA_POS", "VISA_NEG") and score >= thr:
            spans.append(Span(label=grp, text=e.get("word", "").strip(), score=score))
    return spans
```

- [ ] **Step 4: 통과 확인** — Run: `cd ai && uv run --extra dev pytest tests/test_visa_tagger.py -v` → PASS (2 passed).

- [ ] **Step 5: 커밋**

```bash
git add ai/dev_jobs_core/analyzers/visa_tagger.py ai/tests/test_visa_tagger.py
git commit -m "feat(ai): visa token-classification inference module (lazy, graceful)"
```

---

### Task 3: config 추가 (모델 id + 신뢰도 임계)

**Files:**
- Modify: `ai/app/config.py`

- [ ] **Step 1: 설정 필드 추가** — `app/config.py` 의 `Settings` 클래스에서 `embedding_dim` 라인 아래에 추가:

```python
    # 비자 토큰 태깅 모델 (HF Hub id, 예: "youruser/worlddev-visa-tagger").
    # 미설정 시 로컬 비자 분류 비활성 → 키워드/명부/OpenAI폴백/회사추론으로 동작.
    visa_tagger_model: str = ""
    visa_tagger_min_confidence: float = 0.5
```

- [ ] **Step 2: import 가능 확인** — Run: `cd ai && uv run python -c "from app.config import settings; print(settings.visa_tagger_model == '', settings.visa_tagger_min_confidence)"`
Expected: `True 0.5`

- [ ] **Step 3: 커밋**

```bash
git add ai/app/config.py
git commit -m "feat(ai): visa tagger config (model id + confidence threshold)"
```

---

### Task 4: visa_local — 로컬 우선 + 선택 LLM 폴백

**Files:**
- Create: `ai/app/etl/visa_local.py`
- Test: `ai/tests/test_visa_local.py`

- [ ] **Step 1: 실패하는 테스트 작성** — `ai/tests/test_visa_local.py`

```python
import pytest

import app.etl.visa_local as vl
from app.config import settings


def test_local_hit_returns_without_llm(monkeypatch):
    monkeypatch.setattr(vl, "classify_visa_local", lambda t, d: ("sponsors", ["we sponsor"]))

    async def fail_llm(t, d):  # 호출되면 실패
        raise AssertionError("LLM should not be called when local hits")

    monkeypatch.setattr(vl, "classify_visa_llm", fail_llm)
    import asyncio

    assert asyncio.run(vl.resolve_visa("t", "d")) == ("sponsors", ["we sponsor"])


def test_local_abstain_falls_back_to_llm_when_key(monkeypatch):
    monkeypatch.setattr(vl, "classify_visa_local", lambda t, d: ("unclear", []))
    monkeypatch.setattr(settings, "openai_api_key", "key")

    async def llm(t, d):
        return ("no_sponsor", ["must have work auth"])

    monkeypatch.setattr(vl, "classify_visa_llm", llm)
    import asyncio

    assert asyncio.run(vl.resolve_visa("t", "d")) == ("no_sponsor", ["must have work auth"])


def test_local_abstain_no_key_returns_unclear(monkeypatch):
    monkeypatch.setattr(vl, "classify_visa_local", lambda t, d: ("unclear", []))
    monkeypatch.setattr(settings, "openai_api_key", "")
    import asyncio

    assert asyncio.run(vl.resolve_visa("t", "d")) == ("unclear", [])


def test_model_unavailable_falls_back_to_llm_when_key(monkeypatch):
    monkeypatch.setattr(vl, "classify_visa_local", lambda t, d: None)
    monkeypatch.setattr(settings, "openai_api_key", "key")

    async def llm(t, d):
        return ("sponsors", ["visa sponsorship offered"])

    monkeypatch.setattr(vl, "classify_visa_llm", llm)
    import asyncio

    assert asyncio.run(vl.resolve_visa("t", "d")) == ("sponsors", ["visa sponsorship offered"])


def test_model_unavailable_no_key_returns_none(monkeypatch):
    monkeypatch.setattr(vl, "classify_visa_local", lambda t, d: None)
    monkeypatch.setattr(settings, "openai_api_key", "")
    import asyncio

    assert asyncio.run(vl.resolve_visa("t", "d")) is None
```

- [ ] **Step 2: 실패 확인** — Run: `cd ai && uv run --extra dev pytest tests/test_visa_local.py -v` → FAIL.

- [ ] **Step 3: 구현** — `ai/app/etl/visa_local.py`

```python
"""로컬 비자 분류 진입점 — 로컬 태거 우선, abstain/부재 시 선택적 OpenAI 폴백.

reclassify_unclear_visa 3단계에서 classify_visa_llm 자리를 대체한다.
반환 계약은 기존과 동일: (status, evidence) | None.
"""
from __future__ import annotations

from app.config import settings
from app.etl.visa_llm import classify_visa_llm
from dev_jobs_core.analyzers.visa_tagger import tag_spans
from dev_jobs_core.analyzers.visa_tags import spans_to_status


def classify_visa_local(title: str, description: str) -> tuple[str, list[str]] | None:
    """로컬 태깅 모델로만 분류. 모델 부재 시 None."""
    spans = tag_spans(f"{title or ''}\n\n{description or ''}")
    if spans is None:
        return None
    return spans_to_status(spans)


async def resolve_visa(title: str, description: str) -> tuple[str, list[str]] | None:
    """로컬 우선. 로컬이 unclear/부재이고 OPENAI_API_KEY 가 있으면 LLM 폴백."""
    local = classify_visa_local(title, description)
    if local is not None and local[0] != "unclear":
        return local
    if settings.openai_api_key:
        return await classify_visa_llm(title, description)
    return local  # ("unclear", []) 또는 None
```

- [ ] **Step 4: 통과 확인** — Run: `cd ai && uv run --extra dev pytest tests/test_visa_local.py -v` → PASS (5 passed).

- [ ] **Step 5: 커밋**

```bash
git add ai/app/etl/visa_local.py ai/tests/test_visa_local.py
git commit -m "feat(ai): resolve_visa local-first with optional OpenAI fallback"
```

---

### Task 5: reclassify 통합 (3단계 호출부 교체)

**Files:**
- Modify: `ai/app/etl/visa_reclassify.py`

- [ ] **Step 1: import 교체** — `app/etl/visa_reclassify.py` 상단 import 에서 `from .visa_llm import classify_visa_llm` 를 다음으로 교체:

```python
from .visa_local import resolve_visa
```

- [ ] **Step 2: 호출부 교체** — `run(j)` 내부의 다음 줄:

```python
                    cache[desc] = await classify_visa_llm(j["title"], desc)
```

을 다음으로 교체:

```python
                    cache[desc] = await resolve_visa(j["title"], desc)
```

(주변 `cache`/`sem`/`gather` 로직과 `by_llm` 집계는 그대로 둔다 — `resolve_visa` 가 기존과 동일한 `(status, evidence)|None` 을 반환하므로 호환된다. `by_llm` 카운트는 이제 "로컬+폴백으로 해소된 건수"를 의미하므로, 변수 주석을 갱신: `by_llm` 위 주석에 `# 로컬 태거 + (선택)LLM 폴백으로 해소` 추가.)

- [ ] **Step 3: 컴파일/임포트 확인** — Run: `cd ai && uv run python -c "import app.etl.visa_reclassify"`
Expected: 에러 없음(출력 없음).

- [ ] **Step 4: 회귀 — 기존 테스트 통과** — Run: `cd ai && uv run --extra dev pytest -q`
Expected: 모든 테스트 PASS (visa_llm 테스트 포함 — `classify_visa_llm` 은 폴백으로 여전히 존재).

- [ ] **Step 5: 커밋**

```bash
git add ai/app/etl/visa_reclassify.py
git commit -m "feat(ai): wire resolve_visa into reclassify (replaces direct LLM call)"
```

---

### Task 6: 의존성 (transformers 추론 + 학습 extra)

**Files:**
- Modify: `ai/pyproject.toml`

- [ ] **Step 1: extra 수정** — `pyproject.toml` 의 `[project.optional-dependencies]` 를 다음으로 교체:

```toml
[project.optional-dependencies]
embeddings = [
    "sentence-transformers>=2.7",
    "transformers>=4.40",
]
train = [
    "transformers>=4.40",
    "datasets>=2.19",
    "seqeval>=1.2",
    "accelerate>=0.30",
]
dev = [
    "ruff>=0.7",
    "pytest>=8",
    "pytest-asyncio>=0.24",
]
```

(`transformers` 는 추론에 필요하므로 `embeddings` extra 에 둔다 — `sentence-transformers` 가 transformers+torch 를 끌어오지만 파이프라인 사용을 위해 명시. 학습 전용 무거운 패키지는 `train` extra 로 분리.)

- [ ] **Step 2: 추론 의존성 설치 확인** — Run: `cd ai && uv run --extra embeddings python -c "import transformers; print('transformers', transformers.__version__)"`
Expected: `transformers 4.x.y`

- [ ] **Step 3: 커밋**

```bash
git add ai/pyproject.toml ai/uv.lock
git commit -m "build(ai): add transformers (inference) + train extra (datasets/seqeval/accelerate)"
```

---

### Task 7: 약라벨 데이터셋 export 스크립트

**Files:**
- Create: `ai/scripts/export_visa_dataset.py`

DB 의 라벨된 공고를 BIO char-span JSONL 로 변환한다. sponsors/no_sponsor + verbatim 근거가 본문에 있는 건만 양성 스팬으로, unclear 는 빈 스팬(다운샘플), 명부/회사 추론 양성은 제외.

- [ ] **Step 1: 스크립트 작성** — `ai/scripts/export_visa_dataset.py`

```python
"""DB 라벨 → 비자 토큰태깅 학습 데이터셋(JSONL). 약(silver) 라벨.

각 줄: {"text": <description>, "spans": [{"start","end","label"}]}
- sponsors/no_sponsor + visa_evidence 가 본문에 verbatim 으로 있으면 → 그 스팬을 양성으로.
- 근거가 명부/회사추론 마커(본문에 없음)면 → 제외(환각 유발 방지).
- unclear → 빈 스팬(음성). 다수이므로 --neg-ratio 로 다운샘플.
사용: cd ai && uv run python scripts/export_visa_dataset.py --out data/visa_dataset.jsonl
"""
from __future__ import annotations

import argparse
import json
import random

import psycopg

from app.config import settings
from dev_jobs_core.analyzers.visa_tags import find_evidence_span

# 본문에 근거 문구가 없는(명부/회사추론) 양성 — 스팬 학습에서 제외할 마커.
NON_TEXT_MARKERS = ("명부", "Home Office", "USCIS", "IND", "같은 회사", "Employer Data")


def _label_for(status: str) -> str | None:
    if status == "sponsors":
        return "VISA_POS"
    if status == "no_sponsor":
        return "VISA_NEG"
    return None


def build_rows(jobs: list[dict], neg_ratio: float, seed: int = 0) -> list[dict]:
    rng = random.Random(seed)
    pos_rows: list[dict] = []
    neg_pool: list[dict] = []
    for j in jobs:
        text = j["description_text"] or ""
        if len(text) < 20:
            continue
        status = j["visa_status"]
        evidence = j["visa_evidence"] or []
        if status == "unclear":
            neg_pool.append({"text": text, "spans": []})
            continue
        label = _label_for(status)
        if label is None:
            continue
        spans = []
        for quote in evidence:
            if any(m in quote for m in NON_TEXT_MARKERS):
                continue  # 명부/회사추론 — 본문 근거 아님
            found = find_evidence_span(text, quote)
            if found:
                spans.append({"start": found[0], "end": found[1], "label": label})
        if spans:
            pos_rows.append({"text": text, "spans": spans})
        # 양성인데 본문 스팬을 못 찾으면 학습서 제외(라벨 노이즈 방지)
    # 음성 다운샘플: 양성 수 * neg_ratio
    n_neg = min(len(neg_pool), int(len(pos_rows) * neg_ratio))
    neg_rows = rng.sample(neg_pool, n_neg) if n_neg > 0 else []
    rows = pos_rows + neg_rows
    rng.shuffle(rows)
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/visa_dataset.jsonl")
    ap.add_argument("--neg-ratio", type=float, default=2.0)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    with psycopg.connect(settings.database_url) as conn:
        sql = (
            "SELECT id, title, description_text, visa_status, visa_evidence "
            "FROM jobs WHERE is_active = true AND description_text IS NOT NULL"
        )
        if args.limit:
            sql += f" LIMIT {int(args.limit)}"
        rows_db = conn.execute(sql).fetchall()
    jobs = [
        {"id": r[0], "title": r[1], "description_text": r[2], "visa_status": r[3], "visa_evidence": r[4]}
        for r in rows_db
    ]
    rows = build_rows(jobs, args.neg_ratio)

    import os

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    n_pos = sum(1 for r in rows if r["spans"])
    print(f"wrote {len(rows)} rows ({n_pos} with spans, {len(rows) - n_pos} negatives) -> {args.out}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: build_rows 단위 테스트** — `ai/tests/test_export_visa_dataset.py`

```python
import importlib.util
import pathlib

# 스크립트를 모듈로 로드
_spec = importlib.util.spec_from_file_location(
    "export_visa_dataset",
    pathlib.Path(__file__).parent.parent / "scripts" / "export_visa_dataset.py",
)
export_visa_dataset = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(export_visa_dataset)
build_rows = export_visa_dataset.build_rows


def test_excludes_register_evidence_and_aligns_text_quotes():
    jobs = [
        {"id": "1", "title": "t", "description_text": "We can sponsor visas for you.",
         "visa_status": "sponsors", "visa_evidence": ["we can sponsor visas"]},
        {"id": "2", "title": "t", "description_text": "Great team here.",
         "visa_status": "sponsors", "visa_evidence": ["회사가 UK 스폰서 라이선스 보유 (Home Office 등록 스폰서 명부)"]},
        {"id": "3", "title": "t", "description_text": "Some normal posting text body.",
         "visa_status": "unclear", "visa_evidence": []},
    ]
    rows = build_rows(jobs, neg_ratio=2.0, seed=1)
    pos = [r for r in rows if r["spans"]]
    # job1 만 양성 스팬(job2 는 명부 근거→제외)
    assert len(pos) == 1
    span = pos[0]["spans"][0]
    assert pos[0]["text"][span["start"]:span["end"]].lower().startswith("we can sponsor")
    assert span["label"] == "VISA_POS"


def test_downsamples_negatives_by_ratio():
    jobs = [
        {"id": "p", "title": "t", "description_text": "We sponsor visas here.",
         "visa_status": "sponsors", "visa_evidence": ["we sponsor visas"]},
    ] + [
        {"id": f"n{i}", "title": "t", "description_text": f"Unclear posting number {i} body.",
         "visa_status": "unclear", "visa_evidence": []}
        for i in range(10)
    ]
    rows = build_rows(jobs, neg_ratio=2.0, seed=1)
    negs = [r for r in rows if not r["spans"]]
    assert len(negs) == 2  # 1 pos * 2.0
```

- [ ] **Step 3: 테스트 실행** — Run: `cd ai && uv run --extra dev pytest tests/test_export_visa_dataset.py -v` → PASS (2 passed).

- [ ] **Step 4: 커밋**

```bash
git add ai/scripts/export_visa_dataset.py ai/tests/test_export_visa_dataset.py
git commit -m "feat(ai): visa dataset export (DB silver labels -> BIO char-span JSONL)"
```

---

### Task 8: 학습 스크립트 (HF Trainer 파인튜닝)

**Files:**
- Create: `ai/scripts/train_visa_tagger.py`

- [ ] **Step 1: 스크립트 작성** — `ai/scripts/train_visa_tagger.py`

```python
"""비자 토큰태깅 파인튜닝 (HF Trainer). GPU/CPU 동일 실행, 이식성.

입력: export_visa_dataset.py 의 JSONL ({"text", "spans":[{start,end,label}]}).
출력: ./visa-tagger-model (로컬). --push 시 HF Hub 업로드.
사용(예, Colab/Kaggle GPU 또는 로컬 CPU):
  cd ai && uv run --extra train python scripts/train_visa_tagger.py \
      --data data/visa_dataset.jsonl --out ./visa-tagger-model --epochs 4
"""
from __future__ import annotations

import argparse
import json

import numpy as np
from datasets import Dataset
from seqeval.metrics import classification_report, f1_score
from transformers import (
    AutoModelForTokenClassification,
    AutoTokenizer,
    DataCollatorForTokenClassification,
    Trainer,
    TrainingArguments,
)

from dev_jobs_core.analyzers.visa_tags import ID2LABEL, LABEL2ID, LABELS

BASE_MODEL = "xlm-roberta-base"


def load_rows(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def char_spans_to_token_labels(text, spans, tokenizer):
    """char-span 을 서브워드 BIO 라벨로 정렬(offset_mapping 사용)."""
    enc = tokenizer(text, truncation=True, max_length=512, return_offsets_mapping=True)
    labels = [LABEL2ID["O"]] * len(enc["input_ids"])
    for i, (s, e) in enumerate(enc["offset_mapping"]):
        if s == e:  # special token
            labels[i] = -100
            continue
        for sp in spans:
            if s >= sp["start"] and e <= sp["end"]:
                prefix = "B" if s == sp["start"] else "I"
                labels[i] = LABEL2ID[f"{prefix}-{sp['label']}"]
                break
    enc.pop("offset_mapping")
    enc["labels"] = labels
    return enc


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", default="./visa-tagger-model")
    ap.add_argument("--base", default=BASE_MODEL)
    ap.add_argument("--epochs", type=float, default=4)
    ap.add_argument("--push", default="")  # HF Hub repo id; 빈 값이면 업로드 안 함
    args = ap.parse_args()

    rows = load_rows(args.data)
    tokenizer = AutoTokenizer.from_pretrained(args.base)

    feats = [char_spans_to_token_labels(r["text"], r["spans"], tokenizer) for r in rows]
    ds = Dataset.from_list(feats).train_test_split(test_size=0.15, seed=42)

    model = AutoModelForTokenClassification.from_pretrained(
        args.base, num_labels=len(LABELS), id2label=ID2LABEL, label2id=LABEL2ID
    )

    def compute_metrics(p):
        preds = np.argmax(p.predictions, axis=2)
        true_lab, pred_lab = [], []
        for pred, lab in zip(preds, p.label_ids):
            t, q = [], []
            for pi, li in zip(pred, lab):
                if li == -100:
                    continue
                t.append(LABELS[li])
                q.append(LABELS[pi])
            true_lab.append(t)
            pred_lab.append(q)
        return {"f1": f1_score(true_lab, pred_lab)}

    targs = TrainingArguments(
        output_dir=args.out + "-ckpt",
        eval_strategy="epoch",
        save_strategy="epoch",
        num_train_epochs=args.epochs,
        per_device_train_batch_size=8,
        learning_rate=2e-5,
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        logging_steps=20,
    )
    trainer = Trainer(
        model=model,
        args=targs,
        train_dataset=ds["train"],
        eval_dataset=ds["test"],
        tokenizer=tokenizer,
        data_collator=DataCollatorForTokenClassification(tokenizer),
        compute_metrics=compute_metrics,
    )
    trainer.train()

    # 최종 리포트(스팬 단위 P/R/F1)
    preds = trainer.predict(ds["test"])
    pred_ids = np.argmax(preds.predictions, axis=2)
    true_lab, pred_lab = [], []
    for pred, lab in zip(pred_ids, preds.label_ids):
        t, q = [], []
        for pi, li in zip(pred, lab):
            if li == -100:
                continue
            t.append(LABELS[li])
            q.append(LABELS[pi])
        true_lab.append(t)
        pred_lab.append(q)
    print(classification_report(true_lab, pred_lab))

    trainer.save_model(args.out)
    tokenizer.save_pretrained(args.out)
    if args.push:
        model.push_to_hub(args.push)
        tokenizer.push_to_hub(args.push)
        print(f"pushed to https://huggingface.co/{args.push}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: char_spans_to_token_labels 단위 테스트** — `ai/tests/test_train_alignment.py`

```python
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
    tagged = [l for l in enc["labels"] if l not in (-100, 0)]
    assert len(tagged) >= 1  # span 토큰이 B/I-VISA_POS 로 태깅됨
```

(주의: 이 테스트는 `xlm-roberta-base` 토크나이저를 다운로드하므로 `train` extra 필요. CI 에서 무겁다면 이 한 테스트만 `@pytest.mark.slow` 로 분리 가능 — 기본 dev 테스트엔 미포함.)

- [ ] **Step 3: 테스트 실행** — Run: `cd ai && uv run --extra train --extra dev pytest tests/test_train_alignment.py -v` → PASS(또는 transformers 미설치 시 skip).

- [ ] **Step 4: 커밋**

```bash
git add ai/scripts/train_visa_tagger.py ai/tests/test_train_alignment.py
git commit -m "feat(ai): visa tagger training script (HF Trainer + offset alignment)"
```

---

### Task 9: [수동] 데이터 export → 학습 → HF Hub 업로드 → env 설정

코드가 아니라 1회성 운영 절차다. CI/자동화 불가(실데이터 + 외부 GPU + HF 계정 의존). 모델이 없어도 앞 태스크의 코드는 게이팅으로 정상 동작하므로(폴백), 이 태스크 없이도 머지 가능.

- [ ] **Step 1: 데이터셋 export** (dev DB 가 떠 있어야 함)

```bash
cd ai && uv run python scripts/export_visa_dataset.py --out data/visa_dataset.jsonl --neg-ratio 2.0
```
Expected: `wrote N rows (M with spans, ...) -> data/visa_dataset.jsonl` (M ≥ 수백 권장; 적으면 ETL 더 돌려 라벨 축적).

- [ ] **Step 2: (권장) 일부 손보정** — `data/visa_dataset.jsonl` 에서 양성 스팬 수십~수백 건을 눈으로 점검·수정(잘못 정렬된 근거 제거).

- [ ] **Step 3: 학습** — Kaggle/Colab 무료 GPU 노트북(또는 Oracle/로컬 CPU)에 `ai/` 와 `data/visa_dataset.jsonl` 업로드 후:

```bash
uv run --extra train python scripts/train_visa_tagger.py --data data/visa_dataset.jsonl \
    --out ./visa-tagger-model --epochs 4 --push <youruser>/worlddev-visa-tagger
```
Expected: seqeval `classification_report` 출력(VISA_POS/VISA_NEG precision 우선 확인), HF Hub 업로드 URL.

- [ ] **Step 4: 운영/로컬 env 설정**

```bash
# .env 또는 환경변수
VISA_TAGGER_MODEL=<youruser>/worlddev-visa-tagger
# (선택) VISA_TAGGER_MIN_CONFIDENCE=0.6
```

- [ ] **Step 5: 로컬 추론 스모크**

```bash
cd ai && VISA_TAGGER_MODEL=<youruser>/worlddev-visa-tagger uv run --extra embeddings python -c "
from app.etl.visa_local import classify_visa_local
print(classify_visa_local('Backend Engineer', 'We can sponsor visas and offer relocation.'))
print(classify_visa_local('Backend Engineer', 'You must have the right to work in the US.'))
print(classify_visa_local('Backend Engineer', 'Join our team building great products.'))
"
```
Expected: 각각 `('sponsors', [...])`, `('no_sponsor', [...])`, `('unclear', [])` 근방.

---

### Task 10: 라이브 통합 검증 + 최종 게이트

**Files:** 없음(검증만).

- [ ] **Step 1: 전체 ai 테스트** — Run: `cd ai && uv run --extra dev pytest -q`
Expected: 전부 PASS(모델 없이도 — 추론 모듈은 게이팅, resolve_visa 폴백 로직은 monkeypatch 테스트).

- [ ] **Step 2: lint** — Run: `cd ai && uv run --extra dev ruff check .`
Expected: 통과(또는 기존 수준).

- [ ] **Step 3: 모델 설정 후 reclassify 라이브** (Task 9 완료 시) — dev 스택 기동 + `VISA_TAGGER_MODEL` 설정 후 unclear 샘플 재분류 실행, 결과의 근거(`visa_evidence`)가 실제 본문 문구인지 + sponsors/no_sponsor/unclear 카운트를 직전 OpenAI 기준과 대조. 거짓 sponsors 가 늘지 않았는지(정밀도) 확인.

- [ ] **Step 4: OpenAI 미설정 동작 확인** — `OPENAI_API_KEY` 비우고 `VISA_TAGGER_MODEL` 설정 → reclassify 가 로컬만으로 동작(LLM 폴백 호출 0)하는지 로그로 확인.

---

## Self-Review 결과

**Spec coverage:**
- 파이프라인 3단계 교체 + 계약 유지 + OpenAI 선택 폴백 → Task 4·5 ✅
- BIO 스킴 + 상태 도출 + abstain → Task 1(도출) · Task 2(신뢰도 임계 필터) ✅
- 약라벨 자동 생성(LLM근거+키워드, 명부-only 제외, unclear 다운샘플) → Task 7 ✅
- 모델/학습/산출물(xlm-roberta-base, HF Trainer, seqeval, HF Hub, CPU 추론, lazy 로드) → Task 2·6·8·9 ✅
- 게이팅(모델 부재 시 graceful) → Task 2·4 ✅
- 검증(스팬 F1·3분류·gpt-4o-mini 대조·단위·라이브) → Task 8(metrics)·10 ✅
- config(model id, 신뢰도) → Task 3 ✅

**Placeholder scan:** `<youruser>` 는 사용자별 HF 계정 id 로 Task 9(수동)에서만 사용 — 코드 아닌 운영 파라미터라 허용. 그 외 TBD/TODO 없음, 모든 코드 스텝에 실제 코드.

**Type consistency:**
- `Span(label, text, score)` — Task 1 정의, Task 2 생성, Task 1 `spans_to_status` 소비 일치 ✅
- `classify_visa_local(title, description) -> tuple[str,list[str]]|None`, `resolve_visa(...)` async 동일 시그니처 — Task 4 정의, Task 5 호출 일치 ✅
- `LABELS/LABEL2ID/ID2LABEL` — Task 1 정의, Task 8 import 사용 일치 ✅
- `find_evidence_span(text, quote)->(start,end)|None` — Task 1 정의, Task 7 사용 일치 ✅
- 반환 계약 `(status, evidence)|None` 이 기존 `classify_visa_llm` 과 동일 → reclassify 무변경 호환 ✅
