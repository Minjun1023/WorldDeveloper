"""자연어 → 구조화 프로필 (규칙 기반, 순수 함수). LLM 폴백은 라우트에서."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

KNOWN_SKILLS = {
    "go": "Go", "golang": "Go", "python": "Python", "java": "Java",
    "kotlin": "Kotlin", "javascript": "JavaScript", "typescript": "TypeScript",
    "ts": "TypeScript", "react": "React", "vue": "Vue", "angular": "Angular",
    "node": "Node.js", "nodejs": "Node.js", "spring": "Spring", "django": "Django",
    "fastapi": "FastAPI", "rust": "Rust", "scala": "Scala", "ruby": "Ruby",
    "php": "PHP", "aws": "AWS", "gcp": "GCP", "kubernetes": "Kubernetes",
    "k8s": "Kubernetes", "docker": "Docker", "postgresql": "PostgreSQL",
    "postgres": "PostgreSQL", "kafka": "Kafka", "spark": "Spark",
}

KNOWN_LOCATIONS = {
    "베를린": "Berlin", "berlin": "Berlin", "뮌헨": "Munich", "munich": "Munich",
    "암스테르담": "Amsterdam", "amsterdam": "Amsterdam", "런던": "London", "london": "London",
    "더블린": "Dublin", "dublin": "Dublin", "독일": "Germany", "germany": "Germany",
    "네덜란드": "Netherlands", "netherlands": "Netherlands",
    "영국": "United Kingdom", "uk": "United Kingdom",
    "아일랜드": "Ireland", "ireland": "Ireland",
}


@dataclass
class ParsedProfile:
    skills: list[str] = field(default_factory=list)
    seniority: str | None = None
    years_experience: int | None = None
    needs_visa_sponsorship: bool | None = None
    preferred_locations: list[str] = field(default_factory=list)
    remote_preference: str | None = None
    desired_salary_usd: int | None = None
    sufficient: bool = False


def _seniority_from_years(y: int) -> str:
    if y < 2:
        return "junior"
    if y <= 5:
        return "mid"
    return "senior"


def parse_rules(text: str) -> ParsedProfile:
    low = text.lower()
    p = ParsedProfile()

    for tok in re.split(r"[\s,/·、]+", low):
        tok = tok.strip(".")
        canon = KNOWN_SKILLS.get(tok)
        if canon and canon not in p.skills:
            p.skills.append(canon)

    m = re.search(r"(\d+)\s*(년차|년|years?|yrs?)", low)
    if m:
        p.years_experience = int(m.group(1))
        p.seniority = _seniority_from_years(p.years_experience)
    if p.seniority is None:
        if any(k in low for k in ("신입", "주니어", "junior")):
            p.seniority = "junior"
        elif any(k in low for k in ("시니어", "senior", "리드", "lead")):
            p.seniority = "senior"

    for key, canon in KNOWN_LOCATIONS.items():
        if key.isascii() and key.isalpha():
            matched = re.search(rf"\b{re.escape(key)}\b", low) is not None
        else:
            matched = key in low
        if matched and canon not in p.preferred_locations:
            p.preferred_locations.append(canon)

    if any(k in low for k in ("비자", "sponsor", "visa")):
        p.needs_visa_sponsorship = True

    if any(k in low for k in ("원격", "재택", "remote")):
        p.remote_preference = "remote"

    sal = re.search(r"[€$]?\s*(\d{2,3})\s*k\b", low)
    if sal:
        amount = int(sal.group(1)) * 1000
        if "€" in text:
            amount = int(amount * 1.08)
        p.desired_salary_usd = amount

    p.sufficient = bool(p.skills or p.preferred_locations or p.seniority)
    return p
