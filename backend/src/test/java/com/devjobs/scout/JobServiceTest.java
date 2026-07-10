package com.devjobs.scout;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

/** isRegisterVerified 순수 로직 단위 테스트 (DB/Spring 불필요). */
class JobServiceTest {

    @Test
    void ukHomeOfficeEvidenceIsRegisterVerified() {
        assertTrue(JobService.isRegisterVerified(
            List.of("회사가 UK 스폰서 라이선스 보유 (Home Office 등록 스폰서 명부)")));
    }

    @Test
    void usUscisEvidenceIsRegisterVerified() {
        assertTrue(JobService.isRegisterVerified(
            List.of("회사가 미국 H-1B 스폰서 이력 보유 (USCIS Employer Data Hub)")));
    }

    @Test
    void nlIndEvidenceIsRegisterVerified() {
        assertTrue(JobService.isRegisterVerified(
            List.of("회사가 IND 인정 스폰서 (네덜란드 이민청 erkende referenten 명부)")));
    }

    @Test
    void caLmiaEvidenceIsRegisterVerified() {
        assertTrue(JobService.isRegisterVerified(
            List.of("회사가 캐나다 LMIA 승인 고용주 (ESDC Positive LMIA 고용주 명부)")));
    }

    @Test
    void inferredEvidenceIsNotRegisterVerified() {
        assertFalse(JobService.isRegisterVerified(List.of("같은 회사의 다른 공고에 비자 스폰서 명시")));
        assertFalse(JobService.isRegisterVerified(List.of("We offer relocation and visa support.")));
    }

    @Test
    void nullAndEmptyAreNotVerified() {
        assertFalse(JobService.isRegisterVerified(null));
        assertFalse(JobService.isRegisterVerified(List.of()));
    }

    @Test
    void mixedEvidenceVerifiedIfAnyRegister() {
        assertTrue(JobService.isRegisterVerified(
            List.of("기타 근거", "회사가 미국 H-1B 스폰서 이력 보유 (USCIS Employer Data Hub)")));
    }
}
