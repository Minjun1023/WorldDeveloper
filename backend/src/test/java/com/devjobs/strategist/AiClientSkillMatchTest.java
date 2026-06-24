package com.devjobs.strategist;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.devjobs.strategist.AiClient.SkillMatchResult;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * AiClient.skillMatch 파싱/폴백 동작 — 로컬 HttpServer 로 ai 응답을 흉내내 검증.
 * Spring 컨텍스트 불필요(순수 단위 테스트). 200 → 파싱, 비-200 → null(호출 측 폴백 트리거).
 */
class AiClientSkillMatchTest {

    private HttpServer server;

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    private AiClient clientFor(int status, String body) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/skill-match", exchange -> {
            byte[] out = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, out.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(out);
            }
        });
        server.start();
        String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        // Spring 주입 매퍼와 동일하게 미지 필드(engine 등)는 무시 — DTO 가 부분 필드만 매핑하므로.
        ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        return new AiClient(mapper, baseUrl);
    }

    @Test
    void parsesSuccessfulResponse() throws Exception {
        String body = "{\"required\":[\"Python\",\"Kubernetes\",\"gRPC\"],"
            + "\"present\":[\"Python\",\"Kubernetes\"],"
            + "\"missing\":[\"gRPC\"],\"engine\":\"semantic\"}";
        AiClient client = clientFor(200, body);

        SkillMatchResult res = client.skillMatch("JD with python kubernetes grpc", "파이썬 쿠버네티스");
        assertNotNull(res);
        assertEquals(List.of("Python", "Kubernetes", "gRPC"), res.required());
        assertEquals(List.of("Python", "Kubernetes"), res.present());
        assertEquals(List.of("gRPC"), res.missing());
    }

    @Test
    void returnsNullOnNon200() throws Exception {
        AiClient client = clientFor(503, "service unavailable");
        assertNull(client.skillMatch("JD", "resume"));
    }

    @Test
    void returnsNullWhenServiceUnreachable() {
        // 떠 있지 않은 포트 → 연결 실패 → null(폴백 경로).
        ObjectMapper mapper = new ObjectMapper();
        AiClient client = new AiClient(mapper, "http://127.0.0.1:1");
        assertNull(client.skillMatch("JD", "resume"));
    }
}
