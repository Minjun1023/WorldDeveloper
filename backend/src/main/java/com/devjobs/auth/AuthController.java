package com.devjobs.auth;

import com.devjobs.auth.dto.AuthDtos.AuthResult;
import com.devjobs.auth.dto.AuthDtos.ExchangeRequest;
import com.devjobs.auth.dto.AuthDtos.LoginRequest;
import com.devjobs.auth.dto.AuthDtos.RegisterRequest;
import com.devjobs.auth.dto.AuthDtos.ResendRequest;
import com.devjobs.auth.dto.AuthDtos.VerifyRequest;
import com.devjobs.strategist.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
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
    private final String internalSecret;

    public AuthController(AuthService auth,
                          OAuthHandoffService handoff,
                          RateLimiter rateLimiter,
                          @Value("${auth.internal-secret}") String internalSecret) {
        this.auth = auth;
        this.handoff = handoff;
        this.rateLimiter = rateLimiter;
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
        auth.register(r.email(), r.password(), r.displayName());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/login")
    public AuthResult login(@RequestBody LoginRequest r, HttpServletRequest req) {
        rateLimit("login", req);
        return auth.login(r.email(), r.password());
    }

    @PostMapping("/verify-email")
    public ResponseEntity<Void> verify(@RequestBody VerifyRequest r) {
        auth.verifyEmail(r.token());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<Void> resend(@RequestBody ResendRequest r, HttpServletRequest req) {
        rateLimit("resend", req);
        auth.resendVerification(r.email());
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
