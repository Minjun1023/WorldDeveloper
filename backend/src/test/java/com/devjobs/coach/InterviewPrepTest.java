package com.devjobs.coach;

import static org.assertj.core.api.Assertions.assertThat;

import com.devjobs.coach.InterviewPrep.Tier;
import com.devjobs.coach.dto.CoachDtos.InterviewPrepResponse;
import com.devjobs.coach.dto.CoachDtos.StageKit;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** 인터뷰 준비 차등화: 레벨/스택/도메인/원격 신호로 단계 내용이 실제로 달라지는지. */
class InterviewPrepTest {

    private static StageKit stage(InterviewPrepResponse r, String id) {
        return r.stages().stream().filter(s -> s.stage().equals(id)).findFirst().orElseThrow();
    }

    private static String allText(StageKit s) {
        return s.duration() + " | " + s.focus() + " | "
            + String.join(" ", s.commonQuestions()) + " | " + String.join(" ", s.preparationActions());
    }

    @Test
    void tierOf_usesSeniorityThenYears() {
        assertThat(InterviewPrep.tierOf("Junior", null)).isEqualTo(Tier.JUNIOR);
        assertThat(InterviewPrep.tierOf("Intern", null)).isEqualTo(Tier.JUNIOR);
        assertThat(InterviewPrep.tierOf("Senior", null)).isEqualTo(Tier.MID);
        assertThat(InterviewPrep.tierOf("Staff", null)).isEqualTo(Tier.SENIOR);
        assertThat(InterviewPrep.tierOf("Principal", null)).isEqualTo(Tier.SENIOR);
        // seniority 없으면 경력 폴백
        assertThat(InterviewPrep.tierOf(null, 1)).isEqualTo(Tier.JUNIOR);
        assertThat(InterviewPrep.tierOf(null, 10)).isEqualTo(Tier.SENIOR);
        assertThat(InterviewPrep.tierOf(null, 4)).isEqualTo(Tier.MID);
        assertThat(InterviewPrep.tierOf(null, null)).isEqualTo(Tier.MID);
    }

    @Test
    void primaryStack_picksKnownLanguage() {
        assertThat(InterviewPrep.primaryStack(Set.of("go", "docker"))).isEqualTo("Go");
        assertThat(InterviewPrep.primaryStack(Set.of("react", "typescript"))).isEqualTo("TypeScript");
        assertThat(InterviewPrep.primaryStack(Set.of("kafka", "aws"))).isNull();
    }

    @Test
    void domainOf_detectsFromBag() {
        assertThat(InterviewPrep.domainOf(Set.of("payments", "go"))).isEqualTo("fintech");
        assertThat(InterviewPrep.domainOf(Set.of("pytorch"))).isEqualTo("ml");
        assertThat(InterviewPrep.domainOf(Set.of("python"))).isNull();
    }

    @Test
    void juniorAndSeniorProduceDifferentStages() {
        InterviewPrepResponse jr = InterviewPrep.build(
            "j1", "Backend Engineer", "Acme",
            Set.of("python"), Tier.JUNIOR, "Python", null, false, "주니어");
        InterviewPrepResponse sr = InterviewPrep.build(
            "j2", "Staff Engineer", "Acme",
            Set.of("go"), Tier.SENIOR, "Go", "fintech", true, "스태프");

        // 온사이트 라운드 수가 티어에 따라 다름
        assertThat(stage(jr, "onsite").duration()).contains("3~4");
        assertThat(stage(sr, "onsite").duration()).contains("5~6");

        // 시스템 디자인: 주니어는 가볍/생략, 시니어는 마이그레이션·도메인 힌트
        assertThat(stage(jr, "system_design").focus()).contains("가벼운 설계");
        assertThat(allText(stage(sr, "system_design"))).contains("마이그레이션");
        assertThat(allText(stage(sr, "system_design"))).contains("멱등성"); // fintech 도메인 힌트

        // 행동: 주니어=성장/학습, 시니어=멘토링/방향
        assertThat(allText(stage(jr, "behavioral"))).contains("학습");
        assertThat(allText(stage(sr, "behavioral"))).contains("멘토링");

        // 같은 공고 두 개라도 레벨이 다르면 온사이트 내용이 동일하지 않다(차등화 핵심)
        assertThat(allText(stage(jr, "onsite"))).isNotEqualTo(allText(stage(sr, "onsite")));
    }

    @Test
    void remoteAddsVirtualOnsiteAndAsyncBehavioral() {
        InterviewPrepResponse remote = InterviewPrep.build(
            "r1", "Engineer", "Acme", Set.of("go"), Tier.MID, "Go", null, true, "시니어");
        InterviewPrepResponse onsite = InterviewPrep.build(
            "o1", "Engineer", "Acme", Set.of("go"), Tier.MID, "Go", null, false, "시니어");

        assertThat(allText(stage(remote, "onsite"))).contains("버추얼");
        assertThat(stage(remote, "onsite").duration()).contains("버추얼");
        assertThat(allText(stage(onsite, "onsite"))).contains("현장");
        assertThat(allText(stage(remote, "behavioral"))).contains("원격");
        assertThat(remote.detected().remote()).isTrue();
        assertThat(remote.detected().primaryStack()).isEqualTo("Go");
    }

    @Test
    void stackFlavorsPhoneAndTakeHome() {
        InterviewPrepResponse withStack = InterviewPrep.build(
            "s1", "Engineer", "Acme", Set.of("rust"), Tier.MID, "Rust", null, false, "시니어");
        assertThat(allText(stage(withStack, "phone_screen"))).contains("Rust");
        assertThat(allText(stage(withStack, "take_home"))).contains("Rust");

        InterviewPrepResponse noStack = InterviewPrep.build(
            "s2", "Engineer", "Acme", Set.of("kafka"), Tier.MID, null, null, false, "시니어");
        assertThat(noStack.detected().primaryStack()).isNull();
    }
}
