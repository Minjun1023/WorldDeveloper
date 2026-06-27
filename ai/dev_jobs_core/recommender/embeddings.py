"""sentence-transformers 기반 임베딩 wrapper.

- 모델: paraphrase-multilingual-MiniLM-L12-v2 (한/영 모두 OK, 470MB)
- 첫 호출 시에만 로드, 이후 캐싱
- sentence-transformers 미설치 시 graceful fallback (semantic 점수 0)
"""
from __future__ import annotations

import logging
import re
import threading
from functools import lru_cache

log = logging.getLogger(__name__)

MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

_WS = re.compile(r"\s+")


def build_embed_text(
    title: str | None, tags: list[str] | None, plain: str | None
) -> str:
    """임베딩에 넣을 텍스트를 구성한다.

    모델은 128토큰만 보므로(긴 본문은 잘림) 제목·기술스택을 맨 앞에 둬서 역할/도메인
    신호가 회사 소개 보일러플레이트에 묻히지 않게 한다. 'Skills:' 앵커는 쿼리(프로필)
    측 텍스트와 형태를 맞춰(동일 앵커 + 공통 스킬 토큰) 한↔영 교차 코사인을 높인다.
    """
    parts: list[str] = []
    if title:
        parts.append(_WS.sub(" ", title).strip())
    if tags:
        parts.append("Skills: " + ", ".join(tags))
    if plain:
        snippet = _WS.sub(" ", plain).strip()[:400]
        if snippet:
            parts.append(snippet)
    return ". ".join(p for p in parts if p)

_model = None
_load_failed = False
# embed 라우트가 동기 `def` 라 스레드풀에서 동시 실행된다. cold start 에 여러 요청이
# 동시에 _load_model 에 진입하면 470MB 모델을 중복 로드할 수 있어 락으로 1회만 로드.
_load_lock = threading.Lock()


def _load_model():
    """모델을 lazy load. 실패하면 None 반환하고 이후엔 시도 안 함."""
    global _model, _load_failed
    if _model is not None:
        return _model
    if _load_failed:
        return None
    with _load_lock:
        # 락 획득 후 재확인 — 대기 중 다른 스레드가 이미 로드했을 수 있다.
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


def embed_text(text: str) -> list[float] | None:
    """단일 텍스트 임베딩 (ETL/검색용). 모델 없으면 None."""
    v = _embed_cached(text)
    return list(v) if v is not None else None


def embed_texts(texts: list[str]) -> list[list[float] | None]:
    """여러 텍스트를 한 번의 model.encode 로 배치 임베딩한다.

    개별 호출(루프) 대비 모델 인코딩 오버헤드를 1회로 줄인다 — sentence-transformers 는
    리스트를 받으면 벡터화 배치로 처리해 훨씬 빠르다. 입력과 같은 길이/순서로 반환하며
    빈 텍스트·모델 미가용 위치는 None. (캐시는 쓰지 않는다 — 호출부가 매번 다른 텍스트인
    이력서 구절 등 uncached 경로에 쓰는 용도.)
    """
    out: list[list[float] | None] = [None] * len(texts)
    model = _load_model()
    if model is None:
        return out
    idx = [i for i, t in enumerate(texts) if t and t.strip()]
    if not idx:
        return out
    batch = [texts[i][:2000] for i in idx]
    vecs = model.encode(batch, convert_to_numpy=True, show_progress_bar=False)
    for j, i in enumerate(idx):
        out[i] = vecs[j].tolist()
    return out


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
