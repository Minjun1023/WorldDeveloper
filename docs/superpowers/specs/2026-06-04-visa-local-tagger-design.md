# 비자 분류 로컬 딥러닝 전환 (토큰 태깅) — 설계

날짜: 2026-06-04
상태: 설계 승인됨 (스펙 리뷰)
대상: ai/ (FastAPI 임베딩/ETL 서비스) — 비자 분류 한정

## 배경 / 동기

현재 비자 스폰서십 분류는 `ai/app/etl/visa_reclassify.py`의 `reclassify_unclear_visa`가 매 ETL마다 unclear 공고에 대해 4단계로 수행한다:

1. **키워드 정규식** (`dev_jobs_core/analyzers/visa.classify_visa`) — 로컬
2. **정부 명부 대조** (UK Home Office / US USCIS / NL IND, 회사 slug + 국가 위치 매칭) — 로컬·ground truth
3. **LLM** (`app/etl/visa_llm.classify_visa_llm`, gpt-4o-mini) — 전문을 읽어 분류 + verbatim 근거 인용. 인용문이 본문에 실재하는지(`_quote_in_text`) + 비자 관련성(`_visa_relevant`) 검증. "기본 unclear, 명시 문구 없으면 분류 금지, 회사/국가/부재로 추론 금지."
4. **회사 추론** — 같은 회사의 다른 명시-sponsor 공고가 있으면 sponsors

**3번이 비자 파이프라인의 유일한 OpenAI 의존**이다(1·2·4는 로컬/결정적). 이 작업은 본문 텍스트 기반 분류 + grounding(근거 스팬)이라, **파인튜닝한 토큰 분류기(시퀀스 라벨링)로 근거 스팬을 태깅**하는 방식이 더 적합하다 — 태깅된 스팬이 곧 근거라 grounding이 내장되고, CPU로 빠르며, 환각이 없고, "정확도 우선·추측 금지" 철학과 일치한다.

## 승인된 결정 사항

- **범위**: 비자 분류만. 요약(`summarize.py`)·NL 프로필 파싱(`parse_profile.py`)은 OpenAI 유지(이번 범위 밖). 스킬 추출은 같은 모델의 자연스러운 확장이나 범위 밖.
- **GPU 없음**: 추론은 로컬 CPU. 학습은 이식성 있는 스크립트로 무료 GPU(Kaggle/Colab) 또는 CPU(Oracle Always Free ARM/로컬) 어디서든 1회 수행. 학습 호스트는 설계에 영향 없음.
- **라벨**: 기존 데이터 약(silver) 라벨 — DB의 LLM 근거문구 + 키워드 매치 + 일부 손보정.
- **OpenAI 강등**: 필수 → 선택 폴백.

## 1. 파이프라인 배치 & 인터페이스

`reclassify_unclear_visa` 순서 유지, **3번만 교체**:

```
1) 키워드 정규식           (로컬, 그대로)
2) 정부명부 대조 UK/US/NL   (로컬·ground truth, 그대로)
3) ★ 로컬 비자 태깅 모델    ← classify_visa_llm 자리 교체
   3b) (선택) OpenAI 폴백   ← 로컬이 abstain + OPENAI_API_KEY 있을 때만
4) 회사 추론               (로컬, 그대로)
```

- 신규 `app/etl/visa_local.py`의 `classify_visa_local(title: str, description: str) -> tuple[str, list[str]] | None`로 **drop-in 교체**. 반환 계약 = 기존 `classify_visa_llm`과 동일 `(status ∈ {sponsors,no_sponsor,unclear}, evidence: list[str])` 또는 `None`. → 4번·`update_visa`·웹 VisaBadge 무변경.
- OpenAI는 **선택적 폴백**: 로컬 모델이 unclear/저신뢰(abstain)이고 `OPENAI_API_KEY`가 있으면 `classify_visa_llm` 호출. 키 없으면 로컬만으로 완결(기본).
- 게이팅: 모델 id env 미설정/로드 실패 → 로그 + 로컬 단계 스킵(키워드·명부·(OpenAI폴백)·회사추론으로 정상 동작).

## 2. 태깅 스킴 & 상태 도출

**BIO 5태그 토큰 분류:**
- `VISA_POS` — 비자/취업허가 스폰서십 또는 이주(relocation) 제공 문구
- `VISA_NEG` — 기존 취업허가 필수 / 스폰서 안 함 문구
- 그 외 `O`
- 라벨 집합: `O, B-VISA_POS, I-VISA_POS, B-VISA_NEG, I-VISA_NEG`

**상태 도출(결정적 후처리):**
- POS 스팬 존재 → `sponsors` (근거 = POS 스팬 텍스트)
- 아니고 NEG 스팬 존재 → `no_sponsor` (근거 = NEG 스팬)
- 둘 다 없음 → `unclear` (근거 `[]`)
- 둘 다 존재 → POS 우선(스폰서십 필요한 사용자에게 actionable). 동률 시 스팬 신뢰도 높은 쪽.
- **grounding 내장**: 스팬이 본문에서 추출되므로 근거가 항상 실재. 기존 `_quote_in_text`/`_visa_relevant` 검증을 추출로 대체.

**Abstain(기본 unclear·추측 금지 유지):**
- 스팬 토큰 평균 softmax 신뢰도 < 임계값(기본 예: 0.5, 튜닝 대상) → 스팬 무효 → unclear.

## 3. 약라벨 자동 생성

`scripts/export_visa_dataset.py` (신규) — DB를 읽어 BIO 태깅 JSONL 생성:
- status ∈ {sponsors, no_sponsor} + `visa_evidence`가 verbatim 문구인 공고 → 본문에서 문구 위치를 찾아 해당 스팬을 `VISA_POS`/`VISA_NEG`로 태깅.
- 키워드 정규식 매치 스팬 → 추가 약 positive/negative.
- unclear 공고 → 전 토큰 `O`(음성). unclear 다수이므로 **다운샘플**로 균형.
- **정부명부-only 양성 제외**: 본문에 근거 문구가 없고 회사 명부로 sponsors된 건은 스팬 학습에서 제외(넣으면 근거 없는 환각 유발).
- 산출 JSONL을 일부(수백 건) 손보정 후 학습 입력으로 사용.

## 4. 모델 · 학습 · 산출물

- **모델**: `xlm-roberta-base`(기본, 다국어 토큰분류 지원 탄탄) 또는 `microsoft/mdeberta-v3-base`(정확도 약간↑). ~270M, CPU 추론 공고당 ~100–300ms. 헤드 = `AutoModelForTokenClassification`(num_labels=5).
- **학습**: `scripts/train_visa_tagger.py` — JSONL 로드 → 서브워드 라벨 정렬(word→subword 전파) → HF `Trainer` 파인튜닝 → `seqeval`(스팬 P/R/F1) + 도출 3분류 정확도. train/val/test 분할, early stopping, best 저장. GPU/CPU 동일 실행. O 다운샘플·(선택)클래스 가중.
- **산출물**: 가중치(~1GB)는 **HuggingFace Hub**(예: `<user>/worlddev-visa-tagger`)에 올리고 `ai/`가 최초 1회 다운로드·캐시(임베딩/LibreTranslate 모델 다운로드 패턴과 동일). 레포에 커밋 안 함. 모델 id는 env(예: `VISA_TAGGER_MODEL`).
- **추론**: `dev_jobs_core/analyzers/visa_tagger.py` — lazy 싱글톤 로드(embeddings.py 패턴) + `token-classification` 파이프라인. `visa_local.py`가 이를 호출해 스팬→상태 도출.
- **의존성**: `transformers`(명시 추가), `torch`(기존 `[embeddings]` extra), `seqeval`(학습용 `[dev]`).

## 재사용 / 경계

| 신규 | 재사용 |
|---|---|
| visa_tagger.py(추론), visa_local.py(래퍼+폴백), export_visa_dataset.py, train_visa_tagger.py, BIO 스킴/도출 로직 | reclassify 단계 1·2·4, classify_visa(키워드), 정부명부 대조, update_visa/DB, visa_llm(선택 폴백으로 유지), 임베딩 모델 로드 패턴 |

## 검증 계획

- **오프라인**: held-out test → 스팬 F1(seqeval) + 도출 3분류 정확도/정밀도. gold 서브셋에서 gpt-4o-mini 라벨과 **일치율** 비교. **정밀도 우선**(거짓 sponsors가 abstain보다 나쁨) 목표.
- **단위테스트**: 스팬→상태 도출(POS/NEG 우선순위·동률 타이브레이크·abstain 임계) 순수함수 + `classify_visa_local` 계약 반환(저신뢰→None/unclear). 모델 없이 테스트 가능하도록 도출 로직을 분리.
- **라이브(학습 후)**: 실제 unclear 샘플 재분류 → 태깅 근거가 실제 문구인지·라벨 타당성 눈검증 + OpenAI 결과와 sponsors/no_sponsor/unclear 카운트 대조.

## 스코프 제외(후속)

- 스킬/지역/시니어리티 등 추가 엔티티 태깅(같은 모델 확장), 요약·NL파싱 로컬화, 모델 자동 재학습 파이프라인.
