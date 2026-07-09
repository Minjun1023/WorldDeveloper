package com.devjobs.auth.dto;

public final class AuthDtos {

    private AuthDtos() {}

    // emailAlerts: 가입 동의창의 '이메일 알림 수신' 체크값. null(구 클라이언트)은 허용으로 간주.
    public record RegisterRequest(String email, String password, String displayName,
                                  com.devjobs.profile.dto.ProfileDto.Profile profile,
                                  Boolean emailAlerts) {}
    public record LoginRequest(String email, String password) {}
    public record VerifyRequest(String email, String code) {}
    public record ResendRequest(String email) {}
    public record ExchangeRequest(String code) {}
    public record ForgotPasswordRequest(String email) {}
    public record ResetPasswordRequest(String email, String code, String newPassword) {}
    public record WithdrawRequest(String password, String confirm) {}
    public record ChangePasswordRequest(String currentPassword, String newPassword) {}

    /** login / exchange 응답: 세션 JWT + 사용자 식별 정보 */
    public record AuthResult(String token, String userId, String email, String displayName) {}
}
