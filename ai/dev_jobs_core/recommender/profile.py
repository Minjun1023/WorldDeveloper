"""사용자 프로필 데이터 모델과 점수 가중치 정의."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class UserProfile:
    """추천 호출 시 받는 사용자 프로필.

    Claude 가 자연어 대화에서 추출해서 구조화하거나, 사용자가 직접 채워서 전달.
    """
    # --- 필수 ---
    skills: list[str]                          # ["python", "django", "aws"]
    seniority: str                             # "junior" / "mid" / "senior" / "staff" / "principal"
    years_experience: int                      # 5

    # --- 강한 필터 (점수에 큰 영향) ---
    needs_visa_sponsorship: bool = False
    preferred_locations: list[str] = field(default_factory=list)  # ["Berlin", "Amsterdam", "Remote"]
    remote_preference: str = "any"             # "remote_only" / "hybrid_ok" / "any"

    # --- 약한 선호 (점수 조정) ---
    desired_salary_usd: int | None = None      # 최소 희망 연봉 (USD/year)
    excluded_companies: list[str] = field(default_factory=list)

    # --- 의미 매칭용 텍스트 ---
    resume_text: str = ""                      # 이력서 전문 (한/영 무관)
    bio: str = ""                              # 자유 자기소개 ("ML 인프라 관심 백엔드")


@dataclass
class ScoringWeights:
    """각 점수 차원의 가중치. 합이 1.0 이 되도록 정규화하면 좋음."""
    stack: float = 0.42       # 기술 스택 매칭 (최우선, 비중↑: 0.35→0.42)
    visa: float = 0.20        # 비자 적합도
    location: float = 0.08    # 지역 적합도 (비중↓: 0.15→0.08, 약한 스택을 지역만으로 끌어올리지 않도록)
    seniority: float = 0.10   # 시니어리티 매칭
    salary: float = 0.10      # 연봉 만족도
    semantic: float = 0.10    # 임베딩 의미 유사도

    def normalize(self) -> ScoringWeights:
        total = self.stack + self.visa + self.location + self.seniority + self.salary + self.semantic
        if total == 0:
            return self
        return ScoringWeights(
            stack=self.stack / total,
            visa=self.visa / total,
            location=self.location / total,
            seniority=self.seniority / total,
            salary=self.salary / total,
            semantic=self.semantic / total,
        )


DEFAULT_WEIGHTS = ScoringWeights()


def parse_weights(weights: dict | None) -> ScoringWeights:
    """딕셔너리에서 가중치 객체 생성 (지정 안 한 항목은 기본값)."""
    if not weights:
        return DEFAULT_WEIGHTS
    w = ScoringWeights()
    for k, v in weights.items():
        if hasattr(w, k):
            setattr(w, k, float(v))
    return w.normalize()
