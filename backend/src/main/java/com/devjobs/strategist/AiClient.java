package com.devjobs.strategist;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** FastAPI AI 서비스 호출 (임베딩). JDK HttpClient 사용. 실패 시 null → semantic 0 graceful. */
@Component
public class AiClient {

    private static final Logger log = LoggerFactory.getLogger(AiClient.class);

    private final String baseUrl;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_1_1)  // uvicorn 은 HTTP/1.1 — HTTP/2 협상 시 body 누락 방지
        .connectTimeout(Duration.ofSeconds(3)).build();

    public AiClient(ObjectMapper mapper,
                    @Value("${ai.base-url:http://localhost:8001}") String baseUrl) {
        this.mapper = mapper;
        this.baseUrl = baseUrl;
    }

    private record EmbedResponse(List<Double> embedding, int dim, String model) {}

    /** 번역 결과 (AI /internal/translate 응답). */
    public record AiTranslation(String title, String description, String engine) {}

    /** 제목/본문을 lang 으로 번역. 실패(키 미설정/업스트림 오류 포함) 시 null. */
    public AiTranslation translate(String title, String description, String lang) {
        try {
            String json = mapper.writeValueAsString(Map.of(
                "title", title == null ? "" : title,
                "description", description == null ? "" : description,
                "target_lang", lang));
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/internal/translate"))
                .header("content-type", "application/json")
                .timeout(Duration.ofSeconds(70))
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                log.warn("ai translate HTTP {}: {}", resp.statusCode(), resp.body());
                return null;
            }
            return mapper.readValue(resp.body(), AiTranslation.class);
        } catch (Exception e) {
            log.warn("ai translate 실패: {}", e.getMessage());
            return null;
        }
    }

    /** 텍스트 → 임베딩 벡터. 실패하면 null. */
    public List<Double> embed(String text) {
        try {
            String json = mapper.writeValueAsString(Map.of("text", text));
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/internal/embed"))
                .header("content-type", "application/json")
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                log.warn("ai embed HTTP {}: {}", resp.statusCode(), resp.body());
                return null;
            }
            EmbedResponse parsed = mapper.readValue(resp.body(), EmbedResponse.class);
            return parsed.embedding();
        } catch (Exception e) {
            log.warn("ai embed 실패: {}", e.getMessage());
            return null;
        }
    }
}
