package com.devjobs.auth;

import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * 회원가입 비밀번호 정책: 10자 이상, 72바이트 이하, 소문자·대문자·숫자 각 1개 이상 (ASCII).
 * 프론트 web/lib/password.ts 와 동일 규칙 — 변경 시 양쪽 함께 수정.
 */
public final class PasswordPolicy {

    private PasswordPolicy() {}

    public static final int MIN_LENGTH = 10;
    public static final int MAX_BYTES = 72; // BCrypt 한계(초과 시 조용히 잘림)

    /** 위반 시 400 (reason "weak_password: <이유>"). 통과 시 무반환. */
    public static void validate(String raw) {
        if (raw == null || raw.length() < MIN_LENGTH) {
            throw weak("too_short");
        }
        if (raw.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            throw weak("too_long");
        }
        if (raw.chars().noneMatch(c -> c >= 'a' && c <= 'z')) {
            throw weak("need_lowercase");
        }
        if (raw.chars().noneMatch(c -> c >= 'A' && c <= 'Z')) {
            throw weak("need_uppercase");
        }
        if (raw.chars().noneMatch(c -> c >= '0' && c <= '9')) {
            throw weak("need_digit");
        }
    }

    private static ResponseStatusException weak(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "weak_password: " + reason);
    }
}
