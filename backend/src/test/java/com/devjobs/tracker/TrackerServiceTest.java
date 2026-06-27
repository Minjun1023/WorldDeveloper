package com.devjobs.tracker;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.devjobs.scout.JobRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

/** 지원 상태 화이트리스트 검증(순수 단위). 유효하지 않은 status 는 repo 접근 전에 400. */
class TrackerServiceTest {

    private final TrackerService service =
        new TrackerService(mock(ApplicationRepository.class), mock(JobRepository.class));

    @Test
    void rejectsInvalidStatus() {
        assertThatThrownBy(() -> service.track("user-1", "job-1", "hacked", null))
            .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void rejectsNullStatus() {
        assertThatThrownBy(() -> service.track("user-1", "job-1", null, null))
            .isInstanceOf(ResponseStatusException.class);
    }
}
