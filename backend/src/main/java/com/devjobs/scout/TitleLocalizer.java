package com.devjobs.scout;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 영어 공고 제목 → 한국어 표시용 결정적(deterministic) 로컬라이저.
 *
 * <p>기계번역을 쓰지 않는다 — LibreTranslate 등 MT 는 구직자에게 가장 중요한 직급/역할에서 오역한다
 * (예: "Staff Backend Engineer" → "직원 Backend 엔지니어", "Member of Technical Staff" → "기술 책임자").
 * 대신 개발 직함의 표준어를 큐레이션 글로서리로 직접 매핑한다. 구절(여러 단어) 항목을 단어 항목보다
 * 먼저(최장일치) 적용해 "Machine Learning" → "머신러닝" 같은 합성어를 정확히 처리한다.
 *
 * <p>영어 원제목은 화면에 함께 노출하므로(검증 가능), 글로서리에 없는 토큰은 영어로 남겨도 안전하다.
 * 일본어 제목은 Phase 2(별도)에서 처리한다 — 여기서는 한글이 이미 포함된 제목(일본어 등)은 그대로 둔다.
 */
public final class TitleLocalizer {

    private TitleLocalizer() {}

    // 구절(우선) — 합성 직함/역할. 단어 매핑보다 먼저 적용.
    private static final Map<String, String> PHRASES = ordered(new String[][] {
        {"Member of Technical Staff", "테크니컬 스태프"},
        {"Site Reliability Engineer", "사이트 신뢰성 엔지니어"},
        {"Machine Learning", "머신러닝"},
        {"Deep Learning", "딥러닝"},
        {"Data Science", "데이터 사이언스"},
        {"Design System", "디자인 시스템"},
        {"Full Stack", "풀스택"},
        {"Full-Stack", "풀스택"},
        {"Forward Deployed", "포워드 디플로이드"},
        {"Developer Relations", "개발자 릴레이션"},
        {"Solutions Architect", "솔루션스 아키텍트"},
        {"Engineering Manager", "엔지니어링 매니저"},
        {"Technical Lead", "테크니컬 리드"},
        {"Tech Lead", "테크 리드"},
        {"Data Scientist", "데이터 사이언티스트"},
        {"Data Engineer", "데이터 엔지니어"},
        {"Software Engineer", "소프트웨어 엔지니어"},
        {"Product Manager", "프로덕트 매니저"},
        {"Quality Assurance", "QA"},
        // 마침표 포함 약식 직급 — 잔여 "." 가 남지 않도록 구절로 소비.
        {"Sr.", "시니어"},
        {"Jr.", "주니어"},
    });

    // 단어 — 직급·역할·분야·기술. 영어 원제목 병기되므로 미등록 토큰은 영어로 남겨도 무방.
    private static final Map<String, String> WORDS = ordered(new String[][] {
        // 직급/레벨
        {"Senior", "시니어"}, {"Sr", "시니어"}, {"Staff", "스태프"}, {"Principal", "프린시펄"},
        {"Junior", "주니어"}, {"Jr", "주니어"}, {"Lead", "리드"}, {"Mid", "미드"},
        {"Intern", "인턴"}, {"Entry", "엔트리"},
        // 역할
        {"Engineering", "엔지니어링"}, {"Engineer", "엔지니어"}, {"Developer", "개발자"}, {"Manager", "매니저"},
        {"Architect", "아키텍트"}, {"Director", "디렉터"}, {"Scientist", "사이언티스트"},
        {"Designer", "디자이너"}, {"Analyst", "애널리스트"}, {"Specialist", "스페셜리스트"},
        {"Consultant", "컨설턴트"}, {"Researcher", "리서처"}, {"Administrator", "관리자"},
        // 분야/도메인
        {"Software", "소프트웨어"}, {"Backend", "백엔드"}, {"Back-end", "백엔드"},
        {"Frontend", "프론트엔드"}, {"Front-end", "프론트엔드"}, {"Fullstack", "풀스택"},
        {"Data", "데이터"}, {"Platform", "플랫폼"}, {"Infrastructure", "인프라"},
        {"Security", "보안"}, {"Cloud", "클라우드"}, {"Systems", "시스템"}, {"System", "시스템"},
        {"Network", "네트워크"}, {"Mobile", "모바일"}, {"Android", "안드로이드"}, {"Web", "웹"},
        {"Storage", "스토리지"}, {"Search", "검색"}, {"Growth", "그로스"}, {"Analytics", "분석"},
        {"Observability", "옵저버빌리티"}, {"Reliability", "신뢰성"}, {"Research", "리서치"},
        {"Product", "프로덕트"}, {"Enterprise", "엔터프라이즈"}, {"Core", "코어"},
        {"Technical", "테크니컬"}, {"Site", "사이트"}, {"Operations", "운영"}, {"Risk", "리스크"},
        {"Payments", "결제"}, {"Payment", "결제"}, {"Database", "데이터베이스"},
        {"Game", "게임"}, {"Gaming", "게이밍"}, {"Blockchain", "블록체인"}, {"Embedded", "임베디드"},
        {"Application", "애플리케이션"}, {"Applications", "애플리케이션"}, {"Services", "서비스"},
        {"Integration", "통합"}, {"Automation", "자동화"}, {"Performance", "성능"},
        {"Identity", "아이덴티티"}, {"Compute", "컴퓨트"}, {"Networking", "네트워킹"},
        {"Development", "개발"}, {"Native", "네이티브"}, {"Quality", "품질"}, {"Test", "테스트"},
        {"Solutions", "솔루션"}, {"Solution", "솔루션"},
        // 기술/언어
        {"Python", "파이썬"}, {"Java", "자바"}, {"Javascript", "자바스크립트"}, {"Typescript", "타입스크립트"},
        {"React", "리액트"}, {"Kubernetes", "쿠버네티스"}, {"Design", "디자인"},
    });

    // 그대로 두는 약어/표준어(대문자 표준 유지). 매핑하지 않음 — 단어 글로서리에서 제외돼 영어로 남되,
    // 표준 대문자로 정규화한다.
    private static final List<String> KEEP_ACRONYMS = List.of(
        "SRE", "DevOps", "MLOps", "SDE", "QA", "API", "ETL", "ELT", "LLM", "NLP",
        "AI", "ML", "UI", "UX", "iOS", "SaaS", "GenAI", "RAG");

    private static final Pattern HANGUL = Pattern.compile("[\\uAC00-\\uD7A3\\u3040-\\u30FF\\u3400-\\u9FFF]");

    // 적용 순서대로 미리 컴파일한 규칙(요청마다 재컴파일하지 않도록): 구절 → 단어 → 약어정규화.
    private record Rule(Pattern pattern, String replacement) {}
    private static final List<Rule> RULES;
    static {
        List<Rule> rules = new java.util.ArrayList<>();
        for (Map.Entry<String, String> e : PHRASES.entrySet()) rules.add(rule(e.getKey(), e.getValue()));
        for (Map.Entry<String, String> e : WORDS.entrySet()) rules.add(rule(e.getKey(), e.getValue()));
        for (String ac : KEEP_ACRONYMS) rules.add(rule(ac, ac)); // 표준 대문자로 정규화
        RULES = List.copyOf(rules);
    }

    // 단어 경계 기준 대소문자 무시 치환 규칙. "ai"가 "available" 안에 매칭되지 않도록 lookaround 사용.
    private static Rule rule(String from, String to) {
        Pattern p = Pattern.compile("(?<![A-Za-z])" + Pattern.quote(from) + "(?![A-Za-z])",
            Pattern.CASE_INSENSITIVE);
        return new Rule(p, Matcher.quoteReplacement(to));
    }

    private static Map<String, String> ordered(String[][] pairs) {
        // 키 길이 내림차순(최장일치 우선). LinkedHashMap 으로 순서 보존.
        Map<String, String> m = new LinkedHashMap<>();
        List<String[]> sorted = new java.util.ArrayList<>(List.of(pairs));
        sorted.sort((a, b) -> b[0].length() - a[0].length());
        for (String[] p : sorted) m.put(p[0], p[1]);
        return m;
    }

    /**
     * 영어 제목을 한국어 표시용으로 변환. 한국어/일본어 등 비라틴 문자가 이미 들어있으면 원문 유지(null 반환).
     * 글로서리 적용으로 한글이 하나도 생기지 않으면(전부 미등록) null 반환 — 호출부는 영어 원제목만 표시.
     */
    public static String localize(String title) {
        if (title == null || title.isBlank()) return null;
        // 이미 CJK(일본어 등) 포함이면 손대지 않음(Phase 2 대상).
        if (HANGUL.matcher(title).find()) return null;

        String s = title;
        for (Rule r : RULES) {
            s = r.pattern().matcher(s).replaceAll(r.replacement());
        }
        // 글로서리 매칭이 전혀 없었으면(한글 0) 표시 이득 없음 → null.
        return HANGUL.matcher(s).find() ? s.trim() : null;
    }
}
