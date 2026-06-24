"""POST /internal/skill-match — 공고 JD vs 이력서의 보유/미보유 스킬 판정(코치 키워드 갭).

확장된 스킬 taxonomy(app.skills_taxonomy)로 JD 요구 스킬을 추출하고, 이력서에서
각 스킬을 별칭(표면형) 매칭 OR semantic(임베딩 코사인 >= 임계값) 으로 판정한다.
backend CoachChatController.buildContext 가 호출하고, 실패 시 기존 ResumeOptimizer 로 폴백한다.

평가(ai/scripts/skill_match_eval.py): cosine 임계값 0.50 에서 precision 100% 유지, recall 71%→87%.

NOTE: 동기 `def` 핸들러 — Starlette 가 스레드풀에서 실행한다(embed.py 와 동일). 임베딩은
CPU inference 라 `async def` 로 두면 이벤트 루프를 막아 다른 요청까지 멈춘다.
임베딩 backend(sentence-transformers/torch)는 **핸들러 안에서만 지연 import** — ai CI 는
torch 없이 `import app.main` 만 하므로 모듈 최상단 import 는 금지.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..skills_taxonomy import (
    matches_surface,
    phrases,
    required_skills,
    semantic_probe,
)

log = logging.getLogger(__name__)
router = APIRouter()


class SkillMatchRequest(BaseModel):
    jd: str = Field(..., max_length=8_000)
    resume: str = Field(..., max_length=20_000)
    threshold: float = Field(0.5, ge=0.0, le=1.0)


class SkillMatchResponse(BaseModel):
    required: list[str]
    present: list[str]
    missing: list[str]
    engine: str  # "semantic" (임베딩 사용) | "alias-only" (임베딩 미가용)


def _cosine_max(probe_vec, phrase_vecs) -> float:
    """probe 벡터와 이력서 구절 벡터들 간 최대 코사인 유사도. 벡터는 정규화되지 않았다고 가정."""
    import numpy as np

    p = np.asarray(probe_vec, dtype=np.float32)
    pn = np.linalg.norm(p)
    if pn == 0:
        return 0.0
    p = p / pn
    best = 0.0
    for v in phrase_vecs:
        v = np.asarray(v, dtype=np.float32)
        vn = np.linalg.norm(v)
        if vn == 0:
            continue
        sim = float(p @ (v / vn))
        if sim > best:
            best = sim
    return best


def match_skills(jd: str, resume: str, threshold: float = 0.5) -> SkillMatchResponse:
    """JD 요구 스킬 추출 + 이력서 present/missing 판정.

    임베딩 backend 가 있으면 semantic(별칭 OR 코사인>=threshold), 없으면 alias-only.
    임베딩 import/로드는 이 함수 안에서만 발생한다(모듈 import 시점엔 torch 불필요).
    """
    required = required_skills(jd)
    lowered_resume = resume.lower()

    # 별칭(표면형)으로 먼저 잡고, 못 잡은 것만 semantic 후보로 남긴다.
    present_set: set[str] = set()
    pending: list[str] = []
    for skill in required:
        # 모호 표면형(go/rest/es)은 원문 이력서 대상 대소문자 가드 — 산문 'go-getter' 오탐 방지.
        if matches_surface(skill, lowered_resume, resume):
            present_set.add(skill)
        else:
            pending.append(skill)

    engine = "alias-only"
    if pending:
        core_emb = None
        try:
            from dev_jobs_core.recommender import embeddings as core_emb  # noqa: PLC0415

            if not core_emb.is_available():
                core_emb = None
        except Exception as e:  # noqa: BLE001 — 임베딩 미설치/로드 실패는 alias-only 로 graceful
            log.warning("skill-match semantic 비활성(alias-only): %s", e)
            core_emb = None

        if core_emb is not None:
            ph = phrases(resume)
            phrase_vecs = [v for v in (core_emb._embed_cached(p) for p in ph) if v is not None]
            if phrase_vecs:
                engine = "semantic"
                for skill in pending:
                    probe_vec = core_emb._embed_cached(semantic_probe(skill))
                    if probe_vec is None:
                        continue
                    if _cosine_max(probe_vec, phrase_vecs) >= threshold:
                        present_set.add(skill)

    # required 순서를 보존해 present/missing 을 만든다.
    present = [s for s in required if s in present_set]
    missing = [s for s in required if s not in present_set]
    return SkillMatchResponse(required=required, present=present, missing=missing, engine=engine)


@router.post("/skill-match", response_model=SkillMatchResponse)
def skill_match(req: SkillMatchRequest) -> SkillMatchResponse:
    return match_skills(req.jd, req.resume, req.threshold)
