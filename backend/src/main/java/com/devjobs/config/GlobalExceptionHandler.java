package com.devjobs.config;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

/**
 * 전역 예외 → 안전한 JSON 응답.
 * - 파싱류(IllegalArgument 등)는 400 — UUID.fromString(userId) 같은 입력 오류가 500 으로 새지 않게.
 * - 그 외 미처리 예외는 500 + 내부 메시지 미노출(로그에만 전체 스택).
 * ResponseStatusException 은 스프링 기본 처리(의도한 상태코드)를 그대로 둔다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler({ IllegalArgumentException.class, MethodArgumentTypeMismatchException.class })
    public ResponseEntity<Map<String, String>> badRequest(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("error", "bad_request"));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> statusException(ResponseStatusException e) {
        // reason 은 코드가 의도적으로 넣은 짧은 식별자("rate_limited" 등)라 노출 안전.
        String reason = e.getReason() != null ? e.getReason() : "error";
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", reason));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> internal(Exception e) {
        log.error("unhandled exception", e); // 스택은 로그에만 — 응답으로 내부 구조를 노출하지 않는다
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "internal_error"));
    }
}
