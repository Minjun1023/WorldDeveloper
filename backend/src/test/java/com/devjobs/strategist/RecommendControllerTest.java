package com.devjobs.strategist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import com.devjobs.strategist.dto.RecommendDtos.RecommendResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/** 공개 /api/v1/recommend 의 입력 상한 + 레이트리밋 보호 검증(순수 단위). */
class RecommendControllerTest {

    private final RecommendService service = mock(RecommendService.class);
    private final RateLimiter rateLimiter = mock(RateLimiter.class);
    private final RecommendController controller = new RecommendController(service, rateLimiter);
    private final HttpServletRequest http = mock(HttpServletRequest.class);

    private RecommendRequest req(String resume) {
        return new RecommendRequest(List.of("python"), "mid", 3, null, resume,
            false, null, "any", null, null, 10, 2);
    }

    @Test
    void rejectsOversizedResume() {
        // 길이 검증이 레이트리밋보다 먼저 — 거대 입력은 임베딩 호출 전에 400.
        ResponseEntity<?> r = controller.recommend(req("x".repeat(20_001)), http);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void returns429WhenRateLimited() {
        when(rateLimiter.tryAcquire(anyString())).thenReturn(false);
        ResponseEntity<?> r = controller.recommend(req("ok"), http);
        assertThat(r.getStatusCode().value()).isEqualTo(429);
    }

    @Test
    void passesThroughWhenValid() {
        when(rateLimiter.tryAcquire(anyString())).thenReturn(true);
        when(service.recommend(any())).thenReturn(new RecommendResponse(0, 0, List.of()));
        ResponseEntity<?> r = controller.recommend(req("ok"), http);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
