"""HRMOS (hrmos.co) 일본 채용 ATS 커넥터.

공개 채용 페이지가 서버 사이드 렌더링(SSR) HTML 이라 JSON API 없이 파싱한다.
- 목록: GET /pages/{company}/jobs       → 공고 id + 제목 (전량 1페이지)
- 상세: GET /pages/{company}/jobs/{id}  → 제목/본문/근무지

`company` 는 회사의 hrmos 페이지 slug (예: cyberagent-group, koeitecmo).
요청 최소화: 목록 제목에 is_dev_role 를 먼저 적용해 개발직만 상세를 가져온다.
"""
from __future__ import annotations

import html as html_lib
import re
from html.parser import HTMLParser

from ..models import JobPosting

BASE = "https://hrmos.co/pages"

# 목록의 각 공고 카드 (<li class="pg-list-cassette ...">...</li>)
_CASSETTE = re.compile(r'<li class="pg-list-cassette[^"]*">(.*?)</li>', re.DOTALL)
_JOB_HREF = re.compile(r'href="[^"]*?/jobs/(\d+)"')
_H2 = re.compile(r"<h2[^>]*>(.*?)</h2>", re.DOTALL)


def _strip_html(s: str) -> str:
    text = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", html_lib.unescape(text)).strip()


def _parse_list(html: str) -> list[tuple[str, str]]:
    """목록 HTML → [(native_id, title)]. 카드별 첫 job id + 첫 <h2> 제목."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for block in _CASSETTE.findall(html):
        m = _JOB_HREF.search(block)
        if not m:
            continue
        jid = m.group(1)
        if jid in seen:
            continue
        seen.add(jid)
        h2 = _H2.search(block)
        title = _strip_html(h2.group(1)) if h2 else ""
        out.append((jid, title))
    return out


# 자가닫힘/void 태그 — 깊이 추적에서 제외
_VOID = {"br", "img", "hr", "input", "meta", "link", "source", "wbr",
         "area", "base", "col", "embed", "param", "track"}


class _SectionText(HTMLParser):
    """주어진 class 를 가진 '첫' 컨테이너 안의 텍스트만 수집(중첩 깊이 추적)."""

    def __init__(self, target_class: str) -> None:
        super().__init__(convert_charrefs=True)
        self._target = target_class
        self._depth = 0
        self._active = False
        self._done = False
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if self._done or tag in _VOID:
            return
        if not self._active:
            classes = (dict(attrs).get("class") or "").split()
            if self._target in classes:
                self._active = True
                self._depth = 1
        else:
            self._depth += 1

    def handle_startendtag(self, tag, attrs):
        return  # 자가닫힘 태그는 깊이 변화 없음

    def handle_endtag(self, tag):
        if self._active and tag not in _VOID:
            self._depth -= 1
            if self._depth <= 0:
                self._active = False
                self._done = True

    def handle_data(self, data):
        if self._active:
            self.parts.append(data)

    @property
    def text(self) -> str:
        return re.sub(r"\s+", " ", "".join(self.parts)).strip()


def _section_text(html: str, target_class: str) -> str:
    p = _SectionText(target_class)
    p.feed(html)
    return p.text


_TITLE = re.compile(
    r'<h1[^>]*class="[^"]*sg-corporate-name[^"]*"[^>]*>(.*?)</h1>', re.DOTALL)


def _parse_detail(html: str) -> dict[str, str]:
    """상세 HTML → {title, description, location}."""
    tm = _TITLE.search(html)
    title = _strip_html(tm.group(1)) if tm else ""
    return {
        "title": title,
        "description": _section_text(html, "pg-descriptions"),
        "location": _section_text(html, "pg-location-address"),
    }


def _to_posting(company: str, native_id: str, list_title: str,
                detail: dict[str, str]) -> JobPosting:
    """파싱 결과 → JobPosting (순수 함수, 네트워크 없음)."""
    location = detail.get("location", "") or ""
    return JobPosting(
        job_id=f"hrmos:{company}:{native_id}",
        source="hrmos",
        title=detail.get("title") or list_title,
        company=company.replace("-", " ").title(),
        location=location,
        is_remote=("リモート" in location) or ("remote" in location.lower()),
        employment_type="FULLTIME",
        description=detail.get("description", ""),
        apply_url=f"{BASE}/{company}/jobs/{native_id}",
        posted_at="",
        closes_at="",
    )
