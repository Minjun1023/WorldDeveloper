package com.devjobs.strategist;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
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

    /** /internal/parse-profile 응답. */
    public record ParseResult(Profile profile, String source, boolean sufficient) {
        public record Profile(
            List<String> skills,
            String seniority,
            @JsonProperty("years_experience") Integer yearsExperience,
            @JsonProperty("needs_visa_sponsorship") Boolean needsVisaSponsorship,
            @JsonProperty("preferred_locations") List<String> preferredLocations,
            @JsonProperty("remote_preference") String remotePreference,
            @JsonProperty("desired_salary_usd") Integer desiredSalaryUsd
        ) {}
    }

    /** 자연어 → 파싱 프로필. 실패 시 null. */
    public ParseResult parseProfile(String text) {
        try {
            String json = mapper.writeValueAsString(Map.of("text", text, "lang", "ko"));
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/internal/parse-profile"))
                .header("content-type", "application/json")
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                log.warn("ai parse-profile HTTP {}: {}", resp.statusCode(), resp.body());
                return null;
            }
            return mapper.readValue(resp.body(), ParseResult.class);
        } catch (Exception e) {
            log.warn("ai parse-profile 실패: {}", e.getMessage());
            return null;
        }
    }

    /** AI /internal/summarize 응답 (4섹션 + 엔진). */
    public record AiSummary(
        List<String> responsibilities,
        List<String> requirements,
        List<String> visa,
        List<String> compensation,
        String engine
    ) {}

    /** 공고를 한국어 4섹션으로 요약. 실패(키 미설정/업스트림 오류 포함) 시 null. */
    public AiSummary summarize(String title, String description) {
        try {
            String json = mapper.writeValueAsString(Map.of(
                "title", title == null ? "" : title,
                "description", description == null ? "" : description,
                "lang", "ko"));
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/internal/summarize"))
                .header("content-type", "application/json")
                .timeout(Duration.ofSeconds(70))
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                log.warn("ai summarize HTTP {}: {}", resp.statusCode(), resp.body());
                return null;
            }
            return mapper.readValue(resp.body(), AiSummary.class);
        } catch (Exception e) {
            log.warn("ai summarize 실패: {}", e.getMessage());
            return null;
        }
    }

    public record CoachChatMessage(String role, String content) {}
    public record CoachChatResult(String reply, String engine) {}

    /** AI /internal/coach-chat 호출 — context/resume/messages 전달, {reply,engine} 수신. */
    public CoachChatResult coachChat(String context, String resume, List<CoachChatMessage> messages) {
        try {
            String json = mapper.writeValueAsString(Map.of(
                "context", context == null ? "" : context,
                "resume", resume == null ? "" : resume,
                "messages", messages == null ? List.of() : messages));
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/internal/coach-chat"))
                .header("content-type", "application/json")
                .timeout(Duration.ofSeconds(70))
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                log.warn("ai coach-chat HTTP {}: {}", resp.statusCode(), resp.body());
                return null;
            }
            return mapper.readValue(resp.body(), CoachChatResult.class);
        } catch (Exception e) {
            log.warn("ai coach-chat 실패: {}", e.getMessage());
            return null;
        }
    }

    /**
     * AI /internal/coach-chat-stream 호출 — 응답을 평문 청크로 받아 onChunk 로 흘리고 누적 전체를 반환.
     * 실패(키 미설정/업스트림 오류/IO 포함) 시 null. UTF-8 멀티바이트 경계는 InputStreamReader 가 처리.
     */
    public String coachChatStream(String context, String resume, List<CoachChatMessage> messages,
                                  Consumer<String> onChunk) {
        try {
            String json = mapper.writeValueAsString(Map.of(
                "context", context == null ? "" : context,
                "resume", resume == null ? "" : resume,
                "messages", messages == null ? List.of() : messages));
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/internal/coach-chat-stream"))
                .header("content-type", "application/json")
                .timeout(Duration.ofSeconds(120))
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
            HttpResponse<InputStream> resp = http.send(req, HttpResponse.BodyHandlers.ofInputStream());
            if (resp.statusCode() != 200) {
                log.warn("ai coach-chat-stream HTTP {}", resp.statusCode());
                return null;
            }
            StringBuilder full = new StringBuilder();
            try (InputStreamReader reader = new InputStreamReader(resp.body(), StandardCharsets.UTF_8)) {
                char[] cbuf = new char[1024];
                int n;
                while ((n = reader.read(cbuf)) != -1) {
                    String chunk = new String(cbuf, 0, n);
                    full.append(chunk);
                    onChunk.accept(chunk);
                }
            }
            return full.toString();
        } catch (Exception e) {
            log.warn("ai coach-chat-stream 실패: {}", e.getMessage());
            return null;
        }
    }
}
