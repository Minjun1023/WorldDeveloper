"""skill-match 엔드포인트/taxonomy 테스트 — CI-safe(별칭 전용 경로, torch 불필요).

semantic(임베딩) 단언은 모델이 필요해 CI 에서 스킵. 여기선 별칭 매칭과 폴백 동작만 검증한다.
"""

from fastapi.testclient import TestClient

from app.main import app
from app.routes import skill_match as sm
from app.skills_taxonomy import phrases, required_skills, token_hit

client = TestClient(app)


def test_required_extraction_expanded_taxonomy():
    jd = "We use Spring Boot, Kafka, Kubernetes and React. Experience with gRPC and observability."
    req = required_skills(jd)
    assert "Spring" in req
    assert "Kafka" in req
    assert "Kubernetes" in req
    assert "React" in req
    assert "gRPC" in req
    assert "Observability" in req


def test_token_hit_word_boundary_no_false_positive():
    # 'javascript' 안의 'java' 를 잡지 않아야 한다.
    assert token_hit("java", "i love javascript") is False
    assert token_hit("java", "experienced in java and spring") is True


def test_phrases_splits_clauses():
    out = phrases("도커로 컨테이너화, 쿠버네티스 운영 및 카프카 스트리밍")
    assert "도커로 컨테이너화" in out
    assert any("쿠버네티스" in p for p in out)
    assert any("카프카" in p for p in out)


def test_alias_only_present_and_missing(monkeypatch):
    # 임베딩 강제 비활성 → alias-only 경로(torch 유무와 무관하게 결정적).
    monkeypatch.setattr(sm, "match_skills", sm.match_skills)  # keep ref
    import dev_jobs_core.recommender.embeddings as core_emb

    monkeypatch.setattr(core_emb, "is_available", lambda: False)

    jd = "Backend role: Python, Kubernetes, Kafka, gRPC required."
    resume = "파이썬 백엔드 개발, 쿠버네티스 클러스터 운영, 카프카 파이프라인 구축"
    res = sm.match_skills(jd, resume, threshold=0.5)
    assert res.engine == "alias-only"
    # 별칭(파이썬/쿠버네티스/카프카)으로 잡힘
    assert set(res.present) >= {"Python", "Kubernetes", "Kafka"}
    # gRPC 는 별칭 표면형이 이력서에 없어 alias-only 에선 미보유
    assert "gRPC" in res.missing
    # required = present + missing 불변식
    assert set(res.required) == set(res.present) | set(res.missing)


def test_endpoint_returns_200_and_shape():
    jd = "We need Python and Docker experience."
    resume = "파이썬과 도커로 서비스를 운영했습니다."
    r = client.post("/internal/skill-match", json={"jd": jd, "resume": resume})
    assert r.status_code == 200
    body = r.json()
    assert "Python" in body["present"]
    assert "Docker" in body["present"]
    assert body["engine"] in ("semantic", "alias-only")
    assert set(body["required"]) == set(body["present"]) | set(body["missing"])


def test_endpoint_rejects_oversized_jd():
    r = client.post("/internal/skill-match", json={"jd": "x" * 8_001, "resume": "y"})
    assert r.status_code == 422  # pydantic max_length
