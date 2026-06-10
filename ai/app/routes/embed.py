"""POST /internal/embed — 텍스트 → vector(384).

sentence-transformers 미설치 시 graceful fallback: 0벡터 반환 + 경고.
실제 운영에선 `pip install -e ".[embeddings]"` 또는 image 빌드 시 포함.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..config import settings

log = logging.getLogger(__name__)
router = APIRouter()


class EmbedRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10_000)
    model: str | None = None


class EmbedResponse(BaseModel):
    embedding: list[float]
    dim: int
    model: str


# NOTE: 동기 `def` 핸들러 — Starlette 가 스레드풀에서 실행한다.
# 임베딩은 sentence-transformers 모델 로드(첫 1회 ~470MB) + CPU inference 라
# `async def` 로 두면 이벤트 루프를 통째로 막아(health/다른 요청까지 멈춤) 서비스가 wedge 된다.
@router.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    model_name = req.model or settings.embedding_model
    try:
        from dev_jobs_core.recommender import embeddings as core_emb
        if not core_emb.is_available():
            raise RuntimeError("embeddings backend unavailable")
        vec = core_emb._embed_cached(req.text)
        if vec is None:
            raise RuntimeError("embedding returned None")
        return EmbedResponse(embedding=list(vec), dim=len(vec), model=model_name)
    except Exception as e:
        log.warning("Embedding fallback: %s", e)
        return EmbedResponse(
            embedding=[0.0] * settings.embedding_dim,
            dim=settings.embedding_dim,
            model=f"{model_name} (fallback-zero)",
        )
