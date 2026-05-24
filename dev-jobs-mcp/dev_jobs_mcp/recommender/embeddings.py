"""sentence-transformers 기반 임베딩 wrapper.

- 모델: paraphrase-multilingual-MiniLM-L12-v2 (한/영 모두 OK, 470MB)
- 첫 호출 시에만 로드, 이후 캐싱
- sentence-transformers 미설치 시 graceful fallback (semantic 점수 0)
"""
from __future__ import annotations
import logging
from functools import lru_cache

log = logging.getLogger(__name__)

MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

_model = None
_load_failed = False


def _load_model():
    """모델을 lazy load. 실패하면 None 반환하고 이후엔 시도 안 함."""
    global _model, _load_failed
    if _model is not None:
        return _model
    if _load_failed:
        return None
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
        log.info(f"임베딩 모델 로딩 중: {MODEL_NAME} (최초 1회만, 약 470MB)")
        _model = SentenceTransformer(MODEL_NAME)
        return _model
    except ImportError:
        log.warning("sentence-transformers 미설치. 의미 유사도 점수는 0 으로 처리됩니다.")
        log.warning("설치: pip install sentence-transformers")
        _load_failed = True
        return None
    except Exception as e:
        log.warning(f"임베딩 모델 로딩 실패: {e}. 의미 유사도 비활성화.")
        _load_failed = True
        return None


def is_available() -> bool:
    return _load_model() is not None


@lru_cache(maxsize=2048)
def _embed_cached(text: str) -> tuple | None:
    """캐시된 임베딩. 같은 텍스트 재계산 방지."""
    model = _load_model()
    if model is None or not text:
        return None
    # 너무 긴 텍스트는 잘라냄 (대부분 모델이 512 토큰 한계)
    truncated = text[:2000]
    vec = model.encode(truncated, convert_to_numpy=True, show_progress_bar=False)
    return tuple(vec.tolist())  # tuple 로 만들어야 lru_cache 가능


def cosine_similarity(text_a: str, text_b: str) -> float:
    """두 텍스트의 임베딩 코사인 유사도 (0~1, 실패 시 0)."""
    a = _embed_cached(text_a)
    b = _embed_cached(text_b)
    if a is None or b is None:
        return 0.0

    # 순수 파이썬 코사인 (numpy 의존성 제거 가능)
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0

    sim = dot / (norm_a * norm_b)
    # 코사인은 [-1, 1] 범위라 [0, 1] 로 클램프
    return max(0.0, min(1.0, sim))


def warm_up():
    """미리 모델 로드 (서버 시작 시 호출하면 첫 요청 지연 방지)."""
    _load_model()
