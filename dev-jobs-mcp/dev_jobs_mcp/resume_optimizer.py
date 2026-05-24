"""공고별 이력서 키워드 최적화 (휴리스틱).

algorithm:
1) 공고 description + tags 에서 기술 키워드 추출 (stack analyzer 재사용)
2) 이력서를 줄 단위로 분리, 각 줄에서 매칭되는 키워드 개수 셈
3) 매칭 점수 내림차순으로 줄 재정렬 제안
4) 공고에는 있는데 이력서에 없는 키워드 = "추가 검토 필요"
"""
from __future__ import annotations
import re
from typing import Any

from .analyzers import stack as stack_analyzer
from .models import JobPosting


def _split_lines(text: str) -> list[str]:
    """이력서를 비어있지 않은 줄 단위로 분리. bullet/공백 정규화."""
    lines = []
    for raw in (text or "").splitlines():
        s = raw.strip()
        if not s:
            continue
        # 흔한 bullet 문자 제거 (앞쪽에만)
        s = re.sub(r"^[-*•·▪◦●○]+\s*", "", s)
        if len(s) >= 5:  # 너무 짧은 줄은 무시 (헤더 한 단어 등은 보존 안 함)
            lines.append(s)
    return lines


def _line_matches(line: str, keywords: set[str]) -> list[str]:
    """주어진 줄에서 매칭되는 키워드 리스트."""
    line_lower = line.lower()
    return sorted([k for k in keywords if k in line_lower])


def optimize(resume_text: str, job: JobPosting) -> dict[str, Any]:
    """공고에 맞춘 이력서 재배치 제안.

    Returns:
        {
            'job_keywords': [...],
            'reordered_lines': [{'line': '...', 'matched': ['python','aws']}, ...],
            'lead_with': ['python','aws','kubernetes'],  # 강조 추천 키워드
            'missing_keywords': [...],  # 공고에 있는데 이력서엔 없는 것
            'present_keywords': [...],  # 이력서에 이미 있는 것
            'suggestions': [str, ...],  # 자연어 행동 제안
        }
    """
    job_kw = set(stack_analyzer.extract_tech(job.description or ""))
    job_kw |= {t.lower() for t in (job.tags or []) if t}
    job_kw = {k for k in job_kw if k}

    resume_kw_in_text = {k for k in job_kw if k in (resume_text or "").lower()}
    missing = sorted(job_kw - resume_kw_in_text)
    present = sorted(resume_kw_in_text)

    lines = _split_lines(resume_text or "")
    scored = []
    for ln in lines:
        matches = _line_matches(ln, job_kw)
        scored.append({"line": ln, "matched": matches, "score": len(matches)})

    # 점수 내림차순 정렬 (점수 같으면 원래 순서 유지)
    scored_sorted = sorted(
        enumerate(scored),
        key=lambda x: (-x[1]["score"], x[0]),
    )
    reordered = [item for _, item in scored_sorted]

    # 강조 키워드: 매칭된 줄에서 빈도 높은 것
    freq: dict[str, int] = {}
    for item in scored:
        for k in item["matched"]:
            freq[k] = freq.get(k, 0) + 1
    lead_with = [k for k, _ in sorted(freq.items(), key=lambda x: -x[1])][:5]

    suggestions: list[str] = []
    if missing:
        suggestions.append(
            f"공고에 명시됐지만 이력서엔 없는 키워드: {', '.join(missing[:8])}. "
            "실제 경험이 있다면 명시해주세요. 경험 없으면 빼고 다른 강점 강조."
        )
    if lead_with:
        suggestions.append(
            f"상단 3~5줄에 강조할 키워드: {', '.join(lead_with)}. "
            "이력서 첫 1/3 안에 등장하도록 배치하세요."
        )
    # 최상위 줄들 추출
    top_lines = [item["line"] for item in reordered if item["score"] > 0][:3]
    if top_lines:
        suggestions.append("리드 라인 후보 (이력서 첫 부분에 배치 권장):\n  - " + "\n  - ".join(top_lines))
    if not freq:
        suggestions.append(
            "이력서와 공고 키워드 매칭이 거의 없습니다. 이 공고가 본인 프로필과 잘 맞는지 다시 검토 권장."
        )

    return {
        "job_id": job.job_id,
        "job_title": job.title,
        "company": job.company,
        "job_keywords": sorted(job_kw),
        "present_keywords": present,
        "missing_keywords": missing,
        "lead_with": lead_with,
        "reordered_lines": reordered[:20],  # 상위 20개만
        "total_lines": len(lines),
        "suggestions": suggestions,
    }
