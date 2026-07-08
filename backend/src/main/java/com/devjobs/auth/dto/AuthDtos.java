package com.devjobs.auth.dto;

public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(String email, String password, String displayName,
                                  com.devjobs.profile.dto.ProfileDto.Profile profile) {}
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
