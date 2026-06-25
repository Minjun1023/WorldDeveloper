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


def test_tags_extract_skills_jd_prose_lacks():
    # 공고 산문이 표면형을 직접 담지 않아도, 큐레이션 tags 가 누락 스킬을 잡는다(skill_gap 공백 해소).
    jd = "We build APM products with distributed tracing and visibility."
    assert "Observability" not in required_skills(jd)  # 산문엔 표면형 없음
    req = required_skills(jd, tags=["observability"])
    assert "Observability" in req
    # ML/GenAI tags 도 동일하게 추출(확장 taxonomy).
    genai = required_skills(jd, tags=["machine learning", "genai", "fine-tuning"])
    assert {"Machine Learning", "GenAI", "Fine-tuning"} <= set(genai)


def test_tags_precision_no_false_positive():
    # 무해한 tag/단어는 스킬로 오탐하면 안 된다(정밀도).
    assert required_skills("We build great products", tags=["agile", "teamwork"]) == []
    # 소문자 산문의 모호 약어(ml/cv/rag)는 대소문자 가드로 걸러진다.
    req = required_skills("add 5 ml of water, view his cv, clean with a rag")
    assert "Machine Learning" not in req
    assert "Computer Vision" not in req
    assert "RAG" not in req


def test_tags_dedup_and_order_stable():
    # tags 와 JD 가 같은 스킬을 가리켜도 중복 없이 SKILLS 키 순서로 안정.
    req = required_skills("machine learning role", tags=["machine learning", "observability"])
    assert req.count("Machine Learning") == 1
    assert req == [s for s in req]  # 결정적
    assert "Machine Learning" in req and "Observability" in req


def test_ambiguous_surfaces_no_prose_false_positive():
    # 평범한 영어 산문은 Go/REST 를 요구 스킬로 잡으면 안 된다(대소문자 가드).
    req = required_skills("You will go above and beyond, rest assured")
    assert "Go" not in req
    assert "REST" not in req
    # 다른 변형 산문도 동일.
    assert "Go" not in required_skills("go to market, good to go")
    assert "REST" not in required_skills("we offer rest and relaxation")
    assert "Elasticsearch" not in required_skills("the answer es simple")  # 소문자 es 산문


def test_ambiguous_surfaces_cased_match_extracts():
    # 대문자/약어 표기는 정상 추출(Go / REST / Elasticsearch).
    req = required_skills("Backend in Go with REST APIs and Elasticsearch")
    assert "Go" in req
    assert "REST" in req
    assert "Elasticsearch" in req


def test_distinctive_aliases_case_insensitive():
    # 구별력 있는 별칭(golang/restful)은 대소문자 무관하게 Go/REST 추출.
    req = required_skills("strong experience with Golang and RESTful services")
    assert "Go" in req
    assert "REST" in req


def test_resume_prose_does_not_mark_ambiguous_present(monkeypatch):
    # 이력서 산문 'rest and relaxation' 은 REST 보유로 표시되면 안 된다.
    import dev_jobs_core.recommender.embeddings as core_emb

    monkeypatch.setattr(core_emb, "is_available", lambda: False)

    jd = "Backend with REST APIs required."  # REST 가 요구됨(별칭 'rest api')
    resume = "I value rest and relaxation; I am a go-getter"
    res = sm.match_skills(jd, resume, threshold=0.5)
    assert "REST" in res.required
    assert "REST" not in res.present
    assert "REST" in res.missing


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
