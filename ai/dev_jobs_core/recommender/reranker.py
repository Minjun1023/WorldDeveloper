"""sentence-transformers CrossEncoder 기반 리랭커 wrapper.

- 모델: cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 (다국어, 경량 ~400MB)
- 첫 호출 시에만 로드, 이후 캐싱
- sentence-transformers 미설치/로드 실패 시 graceful fallback (빈 점수 반환)

embeddings.py 와 동일한 lazy-load + fallback 컨벤션을 따른다.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)

MODEL_NAME = "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"

_model = None
_load_failed = False

_MAX_CHARS = 2000


def _load_model():
    """모델을 lazy load. 실패하면 None 반환하고 이후엔 시도 안 함."""
    global _model, _load_failed
    if _model is not None:
        return _model
    if _load_failed:
        return None
    try:
        from sentence_transformers import CrossEncoder  # type: ignore

        log.info(f"리랭커 모델 로딩 중: {MODEL_NAME} (최초 1회만)")
        _model = CrossEncoder(MODEL_NAME)
        return _model
    except ImportError:
        log.warning("sentence-transformers 미설치. 리랭킹 비활성화(빈 점수).")
        log.warning("설치: uv sync --extra embeddings")
        _load_failed = True
        return None
    except Exception as e:
        log.warning(f"리랭커 모델 로딩 실패: {e}. 리랭킹 비활성화.")
        _load_failed = True
        return None


def is_available() -> bool:
    return _load_model() is not None


def rerank(query: str, docs: list[str]) -> list[float]:
    """(query, doc) 쌍들의 관련도 점수 리스트. 모델 없거나 docs 비면 []."""
    if not docs:
        return []
    model = _load_model()
    if model is None:
        return []
    q = (query or "")[:_MAX_CHARS]
    pairs = [(q, (d or "")[:_MAX_CHARS]) for d in docs]
    scores = model.predict(pairs)
    if not hasattr(scores, "__iter__"):
        scores = [scores]
    return [float(s) for s in scores]


def warm_up():
    """미리 모델 로드 (첫 요청 지연 방지)."""
    _load_model()
