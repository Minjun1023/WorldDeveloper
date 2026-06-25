package com.devjobs.strategist;

import static org.assertj.core.api.Assertions.assertThat;

import com.devjobs.strategist.dto.ApplicationKitDtos.KitSynthesis;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/**
 * AiClient.applicationKit 파싱/폴백 — 로컬 HttpServer 로 ai 응답을 흉내내 검증.
 * 200 → KitSynthesis 파싱, 도달불가 → null(부분 키트 폴백 트리거).
 */
class AiClientApplicationKitTest {
    @Test void parsesKitSynthesis() throws Exception {
        HttpServer s = HttpServer.create(new InetSocketAddress(0), 0);
        s.createContext("/internal/application-kit", ex -> {
            byte[] b = ("{\"fit_summary\":\"맞음\",\"skill_strategy\":\"보완\","
                + "\"cover_letter\":\"안녕\",\"interview_questions\":[\"Q1\"],\"engine\":\"gpt-4o-mini\"}")
                .getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("content-type", "application/json");
            ex.sendResponseHeaders(200, b.length); ex.getResponseBody().write(b); ex.close();
        });
        s.start();
        try {
            // 전역 Jackson 전략과 동일하게: SNAKE_CASE + unknown 무시. ai 가 fit_summary(snake)로
            // 내보내므로 SNAKE_CASE 가 있어야 record camel 필드(fitSummary)로 매핑된다(#310 교훈).
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper()
                .setPropertyNamingStrategy(com.fasterxml.jackson.databind.PropertyNamingStrategies.SNAKE_CASE)
                .configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
            AiClient ai = new AiClient(mapper, "http://localhost:" + s.getAddress().getPort());
            KitSynthesis k = ai.applicationKit("jd", "resume", java.util.Map.of(), java.util.Map.of());
            assertThat(k).isNotNull();
            assertThat(k.fitSummary()).isEqualTo("맞음");
            assertThat(k.interviewQuestions()).containsExactly("Q1");
        } finally { s.stop(0); }
    }

    @Test void returnsNullWhenUnreachable() {
        AiClient ai = new AiClient(new com.fasterxml.jackson.databind.ObjectMapper(), "http://localhost:1");
        assertThat(ai.applicationKit("jd", "resume", java.util.Map.of(), java.util.Map.of())).isNull();
    }
}
