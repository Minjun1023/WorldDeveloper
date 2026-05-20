"""모든 데이터 소스가 공통으로 사용하는 데이터 모델."""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class JobPosting:
    """모든 소스의 공고를 정규화한 통합 스키마."""
    job_id: str                       # "{source}:{native_id}"
    source: str                       # remoteok, arbeitnow, greenhouse, lever, jsearch
    title: str
    company: str
    location: str = ""
    is_remote: bool = False
    employment_type: str = ""         # FULLTIME, PARTTIME, CONTRACTOR, INTERN
    description: str = ""             # 전체 description (HTML/마크다운 가능)
    apply_url: str = ""
    posted_at: str = ""               # ISO8601 문자열

    # 분석 후 채워지는 필드
    tags: list[str] = field(default_factory=list)         # 기술 스택 태그
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str = ""
    salary_period: str = ""           # YEAR, MONTH, HOUR

    # 비자 분석 결과 (analyzers/visa.py 가 채움)
    visa_status: str = "unclear"      # sponsors / no_sponsor / unclear
    visa_evidence: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
