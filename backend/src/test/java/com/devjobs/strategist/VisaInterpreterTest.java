package com.devjobs.strategist;

import static org.assertj.core.api.Assertions.assertThat;

import com.devjobs.scout.dto.JobDtos.VisaDto;
import java.util.List;
import org.junit.jupiter.api.Test;

class VisaInterpreterTest {
    @Test void registryVerifiedIsStrongest() {
        var r = VisaInterpreter.interpret(new VisaDto("sponsors", List.of("UK Home Office"), true));
        assertThat(r.confidence()).isEqualTo("verified");
        assertThat(r.message()).contains("명부 검증");
    }
    @Test void keywordSponsorsIsLikely() {
        var r = VisaInterpreter.interpret(new VisaDto("sponsors", List.of(), false));
        assertThat(r.confidence()).isEqualTo("likely");
    }
    @Test void unclearNeedsAsking() {
        var r = VisaInterpreter.interpret(new VisaDto("unclear", List.of(), false));
        assertThat(r.confidence()).isEqualTo("unclear");
        assertThat(r.message()).contains("문의");
    }
    @Test void nullStatusTreatedAsUnclear() {
        var r = VisaInterpreter.interpret(new VisaDto(null, null, false));
        assertThat(r.confidence()).isEqualTo("unclear");
    }
}
