package com.devjobs.auth.dto;

public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(String email, String password, String displayName) {}
    public record LoginRequest(String email, String password) {}
    public record VerifyRequest(String token) {}
    public record ResendRequest(String email) {}
    public record ExchangeRequest(String code) {}

    /** login / exchange 응답: 세션 JWT + 사용자 식별 정보 */
    public record AuthResult(String token, String userId, String email, String displayName) {}
}
