"""CLI: 비자 가이드 시드. 사용: python ai/scripts/seed_visa_guides.py"""
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # ai/ 를 import 경로에

from app.visa_guides import seed  # noqa: E402

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    count = seed()
    print(f"seeded {count} visa-guide chunks")
