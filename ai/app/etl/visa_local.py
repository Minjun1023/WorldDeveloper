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
