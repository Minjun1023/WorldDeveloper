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
