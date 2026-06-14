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
        {"Solutions", "솔루션"}, {"Solution", "솔루션"}, {"App", "앱"},
        // 기술/언어
        {"Python", "파이썬"}, {"Java", "자바"}, {"Javascript", "자바스크립트"}, {"Typescript", "타입스크립트"},
        {"React", "리액트"}, {"Kubernetes", "쿠버네티스"}, {"Design", "디자인"},
    });

    // 그대로 두는 약어/표준어(대문자 표준 유지). 매핑하지 않음 — 단어 글로서리에서 제외돼 영어로 남되,
    // 표준 대문자로 정규화한다.
    private static final List<String> KEEP_ACRONYMS = List.of(
        "SRE", "DevOps", "MLOps", "SDE", "QA", "API", "ETL", "ELT", "LLM", "NLP",
        "AI", "ML", "UI", "UX", "iOS", "SaaS", "GenAI", "RAG");

    // 일본어(카타카나/한자) 직함 글로서리 — 카타카나 직함은 영어 음차라 결정적 매핑 가능(MT 불필요).
    // 합성 직함은 한국어 값에 공백을 넣어 "백엔드 엔지니어"처럼 띄어 표기. 일·영 병기 제목도 함께 처리됨.
    private static final Map<String, String> JA_TERMS = ordered(new String[][] {
        {"エンジニアリングマネージャー", "엔지니어링 매니저"},
        {"シニアプロダクトマネージャー", "시니어 프로덕트 매니저"},
        {"アプリケーションエンジニア", "애플리케이션 엔지니어"},
        {"データサイエンティスト", "데이터 사이언티스트"},
        {"セキュリティエンジニア", "보안 엔지니어"},
        {"ソフトウェアエンジニア", "소프트웨어 엔지니어"},
        {"プロダクトマネージャー", "프로덕트 매니저"},
        {"バックエンドエンジニア", "백엔드 엔지니어"},
        {"フロントエンドエンジニア", "프론트엔드 엔지니어"},
        {"モバイルアプリエンジニア", "모바일 앱 엔지니어"},
        {"インフラエンジニア", "인프라 엔지니어"},
        {"システムエンジニア", "시스템 엔지니어"},
        {"データエンジニア", "데이터 엔지니어"},
        {"ゲームプログラマー", "게임 프로그래머"},
        {"クラウドプラットフォーム", "클라우드 플랫폼"},
        {"機械学習リサーチャー", "머신러닝 리서처"},
        {"データサイエンス", "데이터 사이언스"},
        {"オープンポジション", "오픈 포지션"},
        {"Webエンジニア", "웹 엔지니어"},
        {"MLエンジニア", "ML 엔지니어"},
        {"AIエンジニア", "AI 엔지니어"},
        {"機械学習", "머신러닝"},
        {"シニア", "시니어"}, {"ジュニア", "주니어"},
        {"エンジニア", "엔지니어"}, {"マネージャー", "매니저"}, {"リサーチャー", "리서처"},
        {"デベロッパー", "개발자"}, {"アーキテクト", "아키텍트"}, {"デザイナー", "디자이너"},
        {"サイエンティスト", "사이언티스트"}, {"プログラマー", "프로그래머"},
        {"ソフトウェア", "소프트웨어"}, {"アプリケーション", "애플리케이션"},
        {"プロダクト", "프로덕트"}, {"バックエンド", "백엔드"}, {"フロントエンド", "프론트엔드"},
        {"モバイル", "모바일"}, {"アプリ", "앱"}, {"クラウド", "클라우드"},
        {"プラットフォーム", "플랫폼"}, {"システム", "시스템"}, {"ウェブ", "웹"},
        {"セキュリティ", "보안"}, {"データ", "데이터"}, {"インフラ", "인프라"},
        {"ゲーム", "게임"}, {"ハイブリッド", "하이브리드"},
    });

    // 한글 음절(가-힣) — 로컬라이즈가 실제로 한국어를 만들어냈는지 판정용(일본어 잔존과 구분).
    private static final Pattern KOREAN = Pattern.compile("[\\uAC00-\\uD7A3]");

    // 적용 순서대로 미리 컴파일한 규칙(요청마다 재컴파일하지 않도록): 구절(영) → 단어(영) → 일본어 → 약어정규화.
    private record Rule(Pattern pattern, String replacement) {}
    private static final List<Rule> RULES;
    static {
        List<Rule> rules = new java.util.ArrayList<>();
        // 일본어 먼저 — "Webエンジニア" 처럼 Latin+카타카나 합성어를 EN 규칙(Web→웹)이 쪼개기 전에 통째 매핑.
        for (Map.Entry<String, String> e : JA_TERMS.entrySet()) rules.add(jaRule(e.getKey(), e.getValue()));
        for (Map.Entry<String, String> e : PHRASES.entrySet()) rules.add(rule(e.getKey(), e.getValue()));
        for (Map.Entry<String, String> e : WORDS.entrySet()) rules.add(rule(e.getKey(), e.getValue()));
        for (String ac : KEEP_ACRONYMS) rules.add(rule(ac, ac)); // 표준 대문자로 정규화
        RULES = List.copyOf(rules);
    }

    // 영어 단어 규칙: Latin 단어경계. "ai"가 "available" 안에 매칭되지 않도록 lookaround 사용.
    private static Rule rule(String from, String to) {
        Pattern p = Pattern.compile("(?<![A-Za-z])" + Pattern.quote(from) + "(?![A-Za-z])",
            Pattern.CASE_INSENSITIVE);
        return new Rule(p, Matcher.quoteReplacement(to));
    }

    // 일본어 규칙: 카타카나/한자는 Latin 경계가 의미 없고(예 "シニアSRE…"에서 SRE 가 매칭을 막음)
    // 자체로 구분되므로 경계 없는 최장일치(JA_TERMS 길이 내림차순)로 치환한다.
    // 한국어 값 뒤에 공백을 붙인다 — 카타카나는 띄어쓰기 없이 이어져(예 "シニアソフトウェアエンジニア")
    // 인접 항목 변환값이 "시니어소프트웨어"처럼 붙는 걸 막는다(한↔한 경계는 spacing 규칙이 못 띄움).
    // 잉여 공백은 MULTI_SPACE 정리 + trim 으로 제거된다.
    private static Rule jaRule(String from, String to) {
        return new Rule(Pattern.compile(Pattern.quote(from), Pattern.CASE_INSENSITIVE),
            Matcher.quoteReplacement(to + " "));
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
     * 영어/일본어 제목을 한국어 표시용으로 변환. 글로서리(영어+일본어)로 직함을 매핑한다(MT 미사용).
     * 한글이 하나도 생기지 않으면(미등록) null — 호출부는 원제목만 표시. 미등록 토큰(고유명사 등)은 원문 유지.
     */
    public static String localize(String title) {
        if (title == null || title.isBlank()) return null;

        String s = title;
        for (Rule r : RULES) {
            s = r.pattern().matcher(s).replaceAll(r.replacement());
        }
        // 한국어가 전혀 생기지 않았으면(미등록) 표시 이득 없음 → null. (일본어 잔존만으론 부족)
        if (!KOREAN.matcher(s).find()) return null;
        // 카타카나가 붙어있어 한글↔영문이 공백 없이 맞닿은 경우 띄어쓰기(예 "시니어SRE엔지니어").
        s = SPACE_KO_LATIN.matcher(s).replaceAll("$1 $2");
        s = SPACE_LATIN_KO.matcher(s).replaceAll("$1 $2");
        s = MULTI_SPACE.matcher(s).replaceAll(" ");
        return dedupeBilingual(s.trim());
    }

    private static final Pattern SPACE_KO_LATIN = Pattern.compile("([\\uAC00-\\uD7A3])([A-Za-z])");
    private static final Pattern SPACE_LATIN_KO = Pattern.compile("([A-Za-z])([\\uAC00-\\uD7A3])");
    private static final Pattern MULTI_SPACE = Pattern.compile("\\s{2,}");

    // 일·영 병기 제목은 같은 직함이 두 언어로 들어와 로컬라이즈 후 "백엔드 엔지니어/백엔드 엔지니어(...)" 처럼
    // 중복될 수 있다. '/'·'／'·'・' 구분 세그먼트 중 다른 세그먼트에 포함되는(부분문자열) 것을 제거해 정리한다.
    // 단 "AI/ML" 이나 한자 부기(社内DX・생산성…)처럼 한쪽이 한국어를 포함하지 않으면 건드리지 않는다(구분자 의미 보존).
    private static final Pattern SEP = Pattern.compile("[/／・｜]");
    private static String dedupeBilingual(String s) {
        if (!SEP.matcher(s).find()) return s;
        String[] parts = s.split("\\s*[/／・｜]\\s*");
        if (parts.length < 2) return s;
        java.util.List<String> kept = new java.util.ArrayList<>();
        for (String raw : parts) {
            String t = raw.trim();
            if (t.isEmpty()) continue;
            // 한국어가 없는 세그먼트(AI, ML 등)는 슬래시 의미 보존을 위해 합치지 않고 그대로 둔다.
            if (!KOREAN.matcher(t).find()) return s;
            // 가정: 구분된 세그먼트는 같은 직함의 일·영 중복이라 한쪽이 다른 쪽의 부분문자열(긴 쪽 유지).
            // 현재 일본어 14건은 모두 이 패턴. 서로 다른 두 직함이 우연히 부분문자열인 경우는 미발생(후속 시 길이비 게이트 고려).
            boolean redundant = false;
            for (int i = 0; i < kept.size(); i++) {
                if (kept.get(i).contains(t)) { redundant = true; break; }
                if (t.contains(kept.get(i))) { kept.set(i, t); redundant = true; break; }
            }
            if (!redundant) kept.add(t);
        }
        return String.join(" · ", kept);
    }
}
