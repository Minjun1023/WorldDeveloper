package com.devjobs.strategist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.devjobs.strategist.dto.VisaGuideDtos.VisaGuideResponse;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class VisaGuideControllerTest {

    private final VisaGuideQueryService service = mock(VisaGuideQueryService.class);
    private final VisaGuideController controller = new VisaGuideController(service);

    @Test
    void returns200_whenPresent() {
        when(service.forJob("j1")).thenReturn(
            Optional.of(new VisaGuideResponse("가이드", List.of(), "면책")));
        ResponseEntity<VisaGuideResponse> resp = controller.visaGuide("j1");
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().text()).isEqualTo("가이드");
    }

    @Test
    void returns204_whenEmpty() {
        when(service.forJob("j2")).thenReturn(Optional.empty());
        ResponseEntity<VisaGuideResponse> resp = controller.visaGuide("j2");
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }
}
