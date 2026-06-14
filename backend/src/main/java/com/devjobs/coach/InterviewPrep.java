package com.devjobs.coach;

import com.devjobs.coach.dto.CoachDtos.DetectedContext;
import com.devjobs.coach.dto.CoachDtos.InterviewPrepResponse;
import com.devjobs.coach.dto.CoachDtos.StageKit;
import com.devjobs.domain.JobEntity;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 인터뷰 단계별 준비 자료(휴리스틱 템플릿) 생성.
 *
 * <p>5개 스테이지를 한 번에 반환해 프론트에서 탭으로 보여준다. LLM 호출은 없지만,
 * 모든 공고에 동일한 내용을 주지 않도록 공고가 실제로 가진 신호 — <b>레벨(seniority/경력)·
 * 주력 스택·도메인·근무형태(원격)</b> — 로 각 단계의 질문·준비 행동·소요를 차등화한다.
 * 회사별 실제 인터뷰 프로세스 데이터는 없으므로 지어내지 않고, "참고용 휴리스틱"임을 명시한다.
 */
final class InterviewPrep {

    private InterviewPrep() {}

    /** 인터뷰 준비 강조점이 갈리는 레벨 티어(직함 그대로가 아니라 면접 비중 기준). */
    enum Tier { JUNIOR, MID, SENIOR }

    static InterviewPrepResponse generate(JobEntity job) {
        Set<String> skills = TechExtractor.extract(job.getTags(), job.getDescriptionText());
        Tier tier = tierOf(job.getSeniority(), job.getExperienceYears());
        String stack = primaryStack(skills);
        String domain = domainOf(skills, job);
        boolean remote = isRemote(job);

        String companyName = job.getCompany() != null
            ? job.getCompany().getDisplayName() : job.getCompanySlug();

        return build(job.getId(), job.getTitle(), companyName,
            skills, tier, stack, domain, remote, levelLabel(job.getSeniority(), job.getExperienceYears()));
    }

    /** 순수 빌더(테스트 용이) — 추출된 신호만 받아 응답을 만든다. */
    static InterviewPrepResponse build(
        String jobId, String title, String company,
        Set<String> skills, Tier tier, String stack, String domain, boolean remote,
        String levelLabel) {

        List<StageKit> stages = List.of(
            phoneScreen(stack),
            takeHome(tier, stack),
            onsite(tier, remote),
            systemDesign(tier, domain),
            behavioral(tier, remote));

        return new InterviewPrepResponse(
            jobId, title, company,
            stackTopics(skills),
            questionsToAsk(company, tier, remote),
            stages,
            new DetectedContext(levelLabel, stack, remote),
            note(levelLabel, stack, remote));
    }

    // ---------------------------------------------------------------- 신호 추출

    /** seniority + 경력연차를 면접 비중 티어로. seniority 없으면 연차로 폴백. */
    static Tier tierOf(String seniority, Integer years) {
        String s = seniority == null ? "" : seniority.trim().toLowerCase();
        switch (s) {
            case "intern", "entry", "junior" -> { return Tier.JUNIOR; }
            case "staff", "principal", "lead", "distinguished" -> { return Tier.SENIOR; }
            case "senior", "mid", "middle" -> { return Tier.MID; }
            default -> { /* 아래 연차 폴백 */ }
        }
        if (years != null) {
            if (years <= 2) return Tier.JUNIOR;
            if (years >= 8) return Tier.SENIOR;
        }
        return Tier.MID;
    }

    /** 사용자에게 보여줄 감지 레벨 라벨(직함 그대로 + 폴백 연차). */
    static String levelLabel(String seniority, Integer years) {
        String s = seniority == null ? "" : seniority.trim().toLowerCase();
        return switch (s) {
            case "intern" -> "인턴";
            case "entry" -> "신입";
            case "junior" -> "주니어";
            case "mid", "middle" -> "미드";
            case "senior" -> "시니어";
            case "staff" -> "스태프";
            case "principal" -> "프린시플";
            case "lead" -> "리드";
            case "distinguished" -> "디스팅귀시드";
            default -> years != null ? years + "년차" : "레벨 미상";
        };
    }

    /** 주력 언어 1개(우선순위: 백엔드 시스템 언어 → 프론트). 없으면 null. */
    static String primaryStack(Set<String> skills) {
        String[][] langs = {
            {"go", "Go"}, {"golang", "Go"}, {"rust", "Rust"}, {"java", "Java"},
            {"kotlin", "Kotlin"}, {"scala", "Scala"}, {"c++", "C++"}, {"python", "Python"},
            {"ruby", "Ruby"}, {"elixir", "Elixir"}, {"swift", "Swift"}, {"php", "PHP"},
            {"typescript", "TypeScript"}, {"javascript", "JavaScript"},
        };
        for (String[] l : langs) {
            if (skills.contains(l[0])) return l[1];
        }
        return null;
    }

    /** 시스템 디자인 단계에 입힐 도메인 힌트. 공고 스킬 + 회사 태그에서. */
    static String domainOf(Set<String> skills, JobEntity job) {
        Set<String> bag = new LinkedHashSet<>(skills);
        if (job != null && job.getTags() != null) bag.addAll(lower(job.getTags()));
        if (job != null && job.getCompany() != null && job.getCompany().getTags() != null) {
            bag.addAll(lower(job.getCompany().getTags()));
        }
        return domainOf(bag);
    }

    static String domainOf(Set<String> bag) {
        if (anyOf(bag, "fintech", "payments", "banking", "trading")) return "fintech";
        if (anyOf(bag, "ml", "ai", "pytorch", "tensorflow", "llm")) return "ml";
        if (anyOf(bag, "data", "etl", "spark", "airflow", "analytics", "database")) return "data";
        if (anyOf(bag, "security", "infosec")) return "security";
        if (anyOf(bag, "infra", "devtools", "platform", "cloud", "kubernetes")) return "infra";
        return null;
    }

    private static boolean isRemote(JobEntity job) {
        if (Boolean.TRUE.equals(job.getIsRemote())) return true;
        String re = job.getRemoteEligibility();
        return "worldwide".equals(re) || "apac_ok".equals(re);
    }

    // ---------------------------------------------------------------- 스테이지

    private static StageKit phoneScreen(String stack) {
        List<String> q = base(
            "본인 소개 + 최근 프로젝트 한 가지 짧게 설명 (2~3분)",
            "왜 이 회사/포지션에 관심이 있나요?",
            "이력서의 X 프로젝트에 대해 더 자세히 알려주세요",
            "선호하는 협업 방식과 코드리뷰 문화",
            "지금까지 가장 어려웠던 버그/기술 결정");
        if (stack != null) {
            q.add(stack + " 기본 개념 빠른 확인 (메모리/동시성/타입 등)");
        }
        return new StageKit("phone_screen", "폰 스크리닝", "30~45분",
            "이력서 검증, 기본 기술 지식, 회사 핏 초도 확인", q,
            base(
                "60초 본인 소개 스크립트 작성 + 1회 녹음/리뷰",
                "이력서의 모든 프로젝트에 대해 STAR (상황·과제·행동·결과) 1줄씩 정리",
                "왜 이 회사인지 2~3문장으로 답할 수 있게 회사 블로그/제품 훑기"));
    }

    private static StageKit takeHome(Tier tier, String stack) {
        List<String> q = base(
            "(코드 외) README 에 설계 결정의 이유와 트레이드오프 명시",
            "(코드 외) 만약 시간 더 있으면 어떻게 개선할지 한 단락",
            "테스트 커버리지: 최소 happy path + 1~2 edge case");
        if (stack != null) {
            q.add("(코드) " + stack + " 관용구로 작성 — 언어다운 깔끔한 코드가 평가된다");
        }
        List<String> a = base(
            "요구사항 다 읽고 어떤 시간 압박이 있는지 확인 (마감/총 시간)",
            "스코프를 의도적으로 줄이고 README 에 'out of scope' 명시 — 끝까지 못 한 것보다 작아도 마감이 낫다",
            "코드 스타일/린터 셋업: black/ruff/eslint 등 기본 도구 적용",
            "Git 커밋을 의미있는 단위로 (squash 말고 단계가 보이게)");
        if (tier == Tier.JUNIOR) {
            a.add("범위를 작게 잡고 기본기(테스트·README·커밋)를 확실히 — 화려함보다 완성도");
        } else if (tier == Tier.SENIOR) {
            a.add("설계 선택의 트레이드오프와 확장 시 고려사항을 README 에 — 시니어 과제는 '왜'를 본다");
        }
        return new StageKit("take_home", "과제 (Take-home)", "보통 3~8시간 (요구사항에 따라)",
            "프로덕션 수준 코드 작성 능력, 트레이드오프 판단, 문서화", q, a);
    }

    private static StageKit onsite(Tier tier, boolean remote) {
        String duration = switch (tier) {
            case JUNIOR -> "보통 3~4라운드";
            case SENIOR -> "보통 5~6라운드";
            default -> "보통 4~5라운드";
        };
        List<String> q = new ArrayList<>();
        if (tier == Tier.JUNIOR) {
            q.add("라이브 코딩: 자료구조·알고리즘 기본 (배열/해시/트리/그래프 순회, LeetCode easy~medium)");
        } else if (tier == Tier.SENIOR) {
            q.add("라이브 코딩: 알고리즘 비중↓ — 설계·트레이드오프 설명 능력을 더 본다");
        } else {
            q.add("라이브 코딩: 미들 난이도 알고리즘 1~2개 (LeetCode medium 급)");
        }
        q.add("시스템 설계: 'X 같은 서비스 설계해보세요' (open-ended)");
        q.add("행동: 갈등 해결, 실패 경험" + (tier == Tier.SENIOR ? ", 리더십·기술 방향 설정 사례" : ", 협업 사례"));
        q.add("역질문: 팀 구성/책임 범위/오너십/온콜/평가 방식");

        List<String> a = base(
            "라이브 코딩은 '말하면서 푸는' 연습 필수 — 침묵 = 감점",
            "행동 인터뷰 5가지 시나리오 미리 준비 (실패/갈등/리더십/우선순위/배움)",
            "역질문 10개 준비 — 마지막 라운드에 시간 남으면 채울 수 있게");
        if (remote) {
            a.add("버추얼 온사이트: 화면공유 코딩 — 카메라/마이크/IDE/네트워크/공유 화이트보드 사전 점검");
        } else {
            a.add("현장 온사이트: 화이트보드 가능 — 손으로 아키텍처 그리며 설명하는 연습");
        }
        a.add("전날 충분한 수면. 카페인 평소 양 유지 (과량 X)");
        return new StageKit("onsite", "온사이트",
            duration + (remote ? " · 버추얼" : ""),
            "코딩(라이브)·시스템 설계·행동 인터뷰·역질문까지 종합", q, a);
    }

    private static StageKit systemDesign(Tier tier, String domain) {
        if (tier == Tier.JUNIOR) {
            return new StageKit("system_design", "시스템 디자인", "30~45분 (가볍거나 생략되기도 함)",
                "주니어는 보통 가벼운 설계 — 컴포넌트 수준 데이터 흐름 이해 위주",
                base(
                    "주어진 기능을 컴포넌트(클라이언트/서버/DB)로 나눠 설명",
                    "왜 이 데이터 저장 방식(RDB vs KV)인지",
                    "캐시/큐가 왜·언제 필요한지 한 가지 예로"),
                base(
                    "복잡한 분산 설계보다 기본 3티어(웹/앱/DB) 흐름을 또렷이 말하는 연습",
                    "자주 쓰는 컴포넌트(LB·캐시·큐·DB) 각각 '왜 쓰는지' 한 줄로 설명 준비"));
        }
        List<String> q = base(
            "요구사항 명확화 질문부터 시작 (functional + non-functional)",
            "용량 추정 (QPS, 저장 데이터양, bandwidth)",
            "high-level 다이어그램 → 컴포넌트 깊이 파고들기",
            "스케일링/캐싱/일관성/장애 대응 시나리오");
        List<String> a = base(
            "프레임워크 하나 고정: requirements → estimates → API → data model → high-level → deep dive → bottleneck",
            "주요 패턴 복습: load balancing, sharding, replication, queue, CDN, cache invalidation",
            "회사 제품과 유사한 시스템 1~2개 미리 손으로 설계 연습");
        if (tier == Tier.SENIOR) {
            q.add("마이그레이션/롤아웃 전략 (무중단 배포, 백필, 듀얼라이트)");
            q.add("조직·팀 경계가 설계에 주는 영향 (Conway's law, 소유권 분리)");
        }
        String dh = domainHint(domain);
        if (dh != null) a.add(dh);
        return new StageKit("system_design", "시스템 디자인", "45~60분",
            tier == Tier.SENIOR
                ? "확장성·내구성·트레이드오프 + 멀티팀/조직 규모·운영 관점"
                : "확장성·내구성·트레이드오프·운영 관점",
            q, a);
    }

    private static StageKit behavioral(Tier tier, boolean remote) {
        List<String> q;
        List<String> a;
        if (tier == Tier.JUNIOR) {
            q = base(
                "새로운 기술/코드베이스를 빠르게 익힌 경험",
                "코드리뷰·피드백을 받고 고친 경험",
                "막혔을 때 어떻게 도움을 요청하고 풀었나",
                "팀에서 맡은 작은 책임을 끝까지 해낸 사례");
            a = base(
                "성장·학습·협업 중심 일화 3~4개를 STAR 포맷으로 정리",
                "각 일화에 '무엇을 배웠는지' 한 줄 결론 붙이기");
        } else if (tier == Tier.SENIOR) {
            q = base(
                "기술 방향을 설정하거나 팀을 설득한 경험",
                "주니어 멘토링/온보딩으로 팀 역량을 끌어올린 사례",
                "PM/디자인/타팀 등 이해관계자를 조율한 경험",
                "큰 기술 결정에서 잘못 판단한 경험 + 조직 차원의 교훈");
            a = base(
                "리더십·임팩트·조직 영향 일화 5개를 STAR 포맷으로 (방향설정/멘토링/조율/실패/임팩트)",
                "각 일화에 조직 단위 metric (팀 n명, 매출/지연 x% 등) 한 개씩",
                "회사 가치관(values) 페이지를 읽고 본인 일화와 매핑");
        } else {
            q = base(
                "팀원/매니저와 의견 충돌했을 때 어떻게 해결했나",
                "마감이 빠듯할 때 우선순위 결정 사례",
                "기술 결정에서 잘못 판단한 경험 + 거기서 배운 것",
                "동료가 어려워하는 걸 도왔던 사례");
            a = base(
                "STAR 포맷으로 5개 일화 미리 저장 (실패/갈등/리더십/배움/임팩트)",
                "각 일화에 metric (n명 영향, x% 개선 등) 한 개씩 끼워넣기",
                "회사 가치관 (values) 페이지 읽고, 본인 일화와 매핑");
        }
        if (remote) {
            q.add("비동기·원격 환경에서 신뢰를 쌓고 협업한 사례");
            a.add("원격 협업 일화 1개 추가 (문서화·비동기 소통·시차 조율 등)");
        }
        return new StageKit("behavioral", "행동 인터뷰", "30~45분",
            "협업/리더십/판단력 (회사 가치관 정합성)", q, a);
    }

    private static String domainHint(String domain) {
        if (domain == null) return null;
        return switch (domain) {
            case "fintech" -> "결제/금융 도메인이면 멱등성·정확히-한-번 정산·정합성·감사로그를 집중적으로";
            case "ml" -> "ML 도메인이면 서빙 지연·피처 신선도·모델 롤백/버저닝을 설계에 반영";
            case "data" -> "데이터 도메인이면 파이프라인 정합성·지연 vs 정확도·백필 전략을 다뤄보기";
            case "security" -> "보안 도메인이면 위협 모델·최소권한·감사/추적을 설계 초반에";
            case "infra" -> "인프라/플랫폼이면 멀티테넌시·격리·관측성(logs/metrics/traces)을 중심으로";
            default -> null;
        };
    }

    // ---------------------------------------------------------------- 공통 텍스트

    private static List<String> stackTopics(Set<String> skills) {
        List<String> topics = new ArrayList<>();
        if (anyOf(skills, "python")) {
            topics.add("Python: GIL/concurrency, async, type hints, decorators, context managers");
        }
        if (anyOf(skills, "django", "flask", "fastapi")) {
            topics.add("Web framework: ORM N+1, middleware/DI, request lifecycle, auth 패턴");
        }
        if (anyOf(skills, "react", "next.js", "nextjs", "typescript")) {
            topics.add("Frontend: state management, suspense/streaming, hydration, hooks rules");
        }
        if (anyOf(skills, "go", "golang")) {
            topics.add("Go: goroutines/channels, context, error handling, interface 설계");
        }
        if (anyOf(skills, "java", "kotlin")) {
            topics.add("JVM: GC, concurrency, Spring/DI, JIT");
        }
        if (anyOf(skills, "rust")) {
            topics.add("Rust: ownership/borrow, lifetimes, async runtimes, unsafe 경계");
        }
        if (anyOf(skills, "postgresql", "mysql", "postgres", "sql")) {
            topics.add("DB: index types, EXPLAIN, transaction isolation, deadlock");
        }
        if (anyOf(skills, "redis", "kafka", "rabbitmq")) {
            topics.add("Cache/Queue: TTL/eviction, consumer groups, at-least-once vs exactly-once");
        }
        if (anyOf(skills, "aws", "gcp", "azure", "kubernetes", "k8s", "docker")) {
            topics.add("Infra: container 격리, k8s pod/service, IAM, observability (logs/metrics/traces)");
        }
        if (anyOf(skills, "ml", "pytorch", "tensorflow", "ai")) {
            topics.add("ML: train/val/test 분리, overfitting, transformer 기초, eval metric 선택");
        }
        return topics;
    }

    private static List<String> questionsToAsk(String company, Tier tier, boolean remote) {
        List<String> q = base(
            company + " 팀의 일주일은 보통 어떤 모습인가요?",
            "이 포지션이 해결해야 할 가장 큰 기술적 도전은?",
            "온콜/배포/코드리뷰 프로세스가 어떻게 되나요?",
            "지난 6개월 안에 팀에서 가장 자랑스러운 성과는 무엇인가요?",
            "성과 평가는 어떤 기준으로 이뤄지나요?");
        if (tier == Tier.SENIOR) {
            q.add("이 레벨에 기대하는 임팩트의 스코프(팀/조직)는 어디까지인가요?");
        } else if (tier == Tier.JUNIOR) {
            q.add("주니어 온보딩·멘토링은 어떻게 이뤄지나요?");
        }
        if (remote) {
            q.add("원격 팀의 협업·온보딩·시차는 어떻게 운영되나요?");
        }
        return q;
    }

    private static String note(String levelLabel, String stack, boolean remote) {
        String ctx = levelLabel + (stack != null ? " · 주력 " + stack : "") + (remote ? " · 원격" : "");
        return "이 공고의 레벨·스택·근무형태(" + ctx + ")로 일반 단계 가이드를 조정했어요. "
            + "실제 인터뷰 프로세스는 회사마다 다르니 참고용 휴리스틱으로 보고, 회사 정보와 본인 강점을 결합해 맞춤화하세요.";
    }

    // ---------------------------------------------------------------- 유틸

    private static List<String> base(String... items) {
        return new ArrayList<>(List.of(items));
    }

    private static Set<String> lower(List<String> xs) {
        Set<String> out = new LinkedHashSet<>();
        for (String x : xs) {
            if (x != null) out.add(x.toLowerCase());
        }
        return out;
    }

    private static boolean anyOf(Set<String> skills, String... candidates) {
        for (String c : candidates) {
            if (skills.contains(c)) return true;
        }
        return false;
    }
}
