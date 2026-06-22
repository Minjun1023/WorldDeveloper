package com.devjobs.auth;

import com.devjobs.auth.dto.AuthDtos.AuthResult;
import com.devjobs.auth.dto.AuthDtos.ExchangeRequest;
import com.devjobs.auth.dto.AuthDtos.LoginRequest;
import com.devjobs.auth.dto.AuthDtos.RegisterRequest;
import com.devjobs.auth.dto.AuthDtos.ForgotPasswordRequest;
import com.devjobs.auth.dto.AuthDtos.ResendRequest;
import com.devjobs.auth.dto.AuthDtos.ResetPasswordRequest;
import com.devjobs.auth.dto.AuthDtos.VerifyRequest;
import com.devjobs.profile.ProfileService;
import com.devjobs.strategist.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService auth;
    private final OAuthHandoffService handoff;
    private final RateLimiter rateLimiter;
    private final ProfileService profileService;
    private final String internalSecret;

    public AuthController(AuthService auth,
                          OAuthHandoffService handoff,
                          RateLimiter rateLimiter,
                          ProfileService profileService,
                          @Value("${auth.internal-secret}") String internalSecret) {
        this.auth = auth;
        this.handoff = handoff;
        this.rateLimiter = rateLimiter;
        this.profileService = profileService;
        this.internalSecret = internalSecret;
    }

    private void rateLimit(String action, HttpServletRequest req) {
        if (!rateLimiter.tryAcquire(action + ":" + req.getRemoteAddr())) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "rate_limited");
        }
    }

    @PostMapping("/register")
    public ResponseEntity<Void> register(@RequestBody RegisterRequest r, HttpServletRequest req) {
        rateLimit("register", req);
        UUID userId = auth.register(r.email(), r.password(), r.displayName());
        if (userId != null && r.profile() != null
                && r.profile().skills() != null && !r.profile().skills().isEmpty()) {
            profileService.upsert(userId, r.profile());
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/login")
    public AuthResult login(@RequestBody LoginRequest r, HttpServletRequest req) {
        rateLimit("login", req);
        return auth.login(r.email(), r.password());
    }

    @PostMapping("/verify-email")
    public ResponseEntity<Void> verify(@RequestBody VerifyRequest r, HttpServletRequest req) {
        rateLimit("verify", req); // 6자리 코드 무차별 대입 방지(IP 고정창 한도)
        auth.verifyEmail(r.email(), r.code());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<Void> resend(@RequestBody ResendRequest r, HttpServletRequest req) {
        rateLimit("resend", req);
        auth.resendVerification(r.email());
        return ResponseEntity.ok().build();
    }

    /** 비밀번호 재설정 코드 발송. 계정 열거 방지를 위해 항상 200(존재 여부 비노출). */
    @PostMapping("/forgot-password")
    public ResponseEntity<Void> forgotPassword(@RequestBody ForgotPasswordRequest r, HttpServletRequest req) {
        rateLimit("forgot", req);
        auth.requestPasswordReset(r.email());
        return ResponseEntity.ok().build();
    }

    /** 이메일+6자리 코드로 비밀번호 재설정. */
    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@RequestBody ResetPasswordRequest r, HttpServletRequest req) {
        rateLimit("reset", req); // 코드 무차별 대입 방지
        auth.resetPassword(r.email(), r.code(), r.newPassword());
        return ResponseEntity.ok().build();
    }

    private static final int CHECK_CAPACITY = 60; // availability 확인은 디바운스로 자주 호출됨 → 더 넉넉히

    private void rateLimitChecks(HttpServletRequest req) {
        if (!rateLimiter.tryAcquire("check:" + req.getRemoteAddr(), CHECK_CAPACITY)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "rate_limited");
        }
    }

    @GetMapping("/check-name")
    public Map<String, Boolean> checkName(@RequestParam String name, HttpServletRequest req) {
        rateLimitChecks(req);
        return Map.of("available", auth.isDisplayNameAvailable(name));
    }

    @GetMapping("/check-email")
    public Map<String, Boolean> checkEmail(@RequestParam String email, HttpServletRequest req) {
        rateLimitChecks(req);
        AuthService.EmailAvailability r = auth.checkEmail(email);
        return Map.of("valid", r.valid(), "available", r.available());
    }

    @PostMapping("/exchange")
    public AuthResult exchange(@RequestHeader(value = "X-Internal-Auth", required = false) String secret,
                               @RequestBody ExchangeRequest r) {
        if (internalSecret == null || internalSecret.isBlank() || !internalSecret.equals(secret)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "forbidden");
        }
        return handoff.exchange(r.code());
    }
}
