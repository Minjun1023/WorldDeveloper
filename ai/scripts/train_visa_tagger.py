"""비자 토큰태깅 파인튜닝 (HF Trainer). GPU/CPU 동일 실행, 이식성.

입력: export_visa_dataset.py 의 JSONL ({"text", "spans":[{start,end,label}]}).
출력: ./visa-tagger-model (로컬). --push 시 HF Hub 업로드.
사용(예, Colab/Kaggle GPU 또는 로컬 CPU):
  cd ai && uv run --extra train python scripts/train_visa_tagger.py \
      --data data/visa_dataset.jsonl --out ./visa-tagger-model --epochs 4
"""
from __future__ import annotations

import argparse
import json

import numpy as np
from datasets import Dataset
from seqeval.metrics import classification_report, f1_score
from transformers import (
    AutoModelForTokenClassification,
    AutoTokenizer,
    DataCollatorForTokenClassification,
    Trainer,
    TrainingArguments,
)

from dev_jobs_core.analyzers.visa_tags import ID2LABEL, LABEL2ID, LABELS

BASE_MODEL = "xlm-roberta-base"


def load_rows(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def char_spans_to_token_labels(text, spans, tokenizer):
    """char-span 을 서브워드 BIO 라벨로 정렬(offset_mapping 사용)."""
    enc = tokenizer(text, truncation=True, max_length=512, return_offsets_mapping=True)
    labels = [LABEL2ID["O"]] * len(enc["input_ids"])
    for i, (s, e) in enumerate(enc["offset_mapping"]):
        if s == e:  # special token
            labels[i] = -100
            continue
        for sp in spans:
            if s >= sp["start"] and e <= sp["end"]:
                prefix = "B" if s == sp["start"] else "I"
                labels[i] = LABEL2ID[f"{prefix}-{sp['label']}"]
                break
    enc.pop("offset_mapping")
    enc["labels"] = labels
    return enc


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", default="./visa-tagger-model")
    ap.add_argument("--base", default=BASE_MODEL)
    ap.add_argument("--epochs", type=float, default=4)
    ap.add_argument("--push", default="")  # HF Hub repo id; 빈 값이면 업로드 안 함
    args = ap.parse_args()

    rows = load_rows(args.data)
    tokenizer = AutoTokenizer.from_pretrained(args.base)

    feats = [char_spans_to_token_labels(r["text"], r["spans"], tokenizer) for r in rows]
    ds = Dataset.from_list(feats).train_test_split(test_size=0.15, seed=42)

    model = AutoModelForTokenClassification.from_pretrained(
        args.base, num_labels=len(LABELS), id2label=ID2LABEL, label2id=LABEL2ID
    )

    def compute_metrics(p):
        preds = np.argmax(p.predictions, axis=2)
        true_lab, pred_lab = [], []
        for pred, lab in zip(preds, p.label_ids, strict=False):
            t, q = [], []
            for pi, li in zip(pred, lab, strict=False):
                if li == -100:
                    continue
                t.append(LABELS[li])
                q.append(LABELS[pi])
            true_lab.append(t)
            pred_lab.append(q)
        return {"f1": f1_score(true_lab, pred_lab)}

    targs = TrainingArguments(
        output_dir=args.out + "-ckpt",
        eval_strategy="epoch",
        save_strategy="epoch",
        num_train_epochs=args.epochs,
        per_device_train_batch_size=8,
        learning_rate=2e-5,
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        logging_steps=20,
    )
    trainer = Trainer(
        model=model,
        args=targs,
        train_dataset=ds["train"],
        eval_dataset=ds["test"],
        tokenizer=tokenizer,
        data_collator=DataCollatorForTokenClassification(tokenizer),
        compute_metrics=compute_metrics,
    )
    trainer.train()

    # 최종 리포트(스팬 단위 P/R/F1)
    preds = trainer.predict(ds["test"])
    pred_ids = np.argmax(preds.predictions, axis=2)
    true_lab, pred_lab = [], []
    for pred, lab in zip(pred_ids, preds.label_ids, strict=False):
        t, q = [], []
        for pi, li in zip(pred, lab, strict=False):
            if li == -100:
                continue
            t.append(LABELS[li])
            q.append(LABELS[pi])
        true_lab.append(t)
        pred_lab.append(q)
    print(classification_report(true_lab, pred_lab))

    trainer.save_model(args.out)
    tokenizer.save_pretrained(args.out)
    if args.push:
        model.push_to_hub(args.push)
        tokenizer.push_to_hub(args.push)
        print(f"pushed to https://huggingface.co/{args.push}")


if __name__ == "__main__":
    main()
