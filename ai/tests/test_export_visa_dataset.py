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
         "visa_status": "sponsors",
         "visa_evidence": ["회사가 UK 스폰서 라이선스 보유 (Home Office 등록 스폰서 명부)"]},
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


def test_normalizes_ai_prefix_and_keyword_ellipsis_and_includes_title():
    # 실제 producer 포맷: LLM 은 "AI: ..." 접두사, 키워드는 앞뒤 생략부호.
    jobs = [
        {"id": "a", "title": "Backend Engineer",
         "description_text": "Relocation help: we offer visa sponsorship to all.",
         "visa_status": "sponsors", "visa_evidence": ["AI: we offer visa sponsorship"]},
        {"id": "b", "title": "SRE",
         "description_text": "Note: visa sponsorship available for this role here.",
         "visa_status": "sponsors",
         "visa_evidence": ["...visa sponsorship available for this role...."]},
    ]
    rows = build_rows(jobs, neg_ratio=0.0, seed=1)
    pos = [r for r in rows if r["spans"]]
    assert len(pos) == 2  # 정규화 후 둘 다 정렬됨
    for r in pos:
        sp = r["spans"][0]
        assert "visa sponsorship" in r["text"][sp["start"] : sp["end"]].lower()
        assert r["text"].split("\n\n", 1)[0] in ("Backend Engineer", "SRE")  # title 포함


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
