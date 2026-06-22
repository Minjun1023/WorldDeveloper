package com.devjobs.auth;

import com.devjobs.auth.dto.AuthDtos.WithdrawRequest;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 로그인 사용자 계정 관리(회원탈퇴). 인증 필요(/api/v1/me/**). */
@RestController
@RequestMapping("/api/v1/me/account")
public class AccountController {

    private final AuthService auth;

    public AccountController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/withdraw")
    public ResponseEntity<?> withdraw(@AuthenticationPrincipal String userId,
                                      @RequestBody(required = false) WithdrawRequest body) {
        if (userId == null || "anonymousUser".equals(userId)) {
            return ResponseEntity.status(401).body(Map.of("error", "unauthorized"));
        }
        String pw = body != null ? body.password() : null;
        String confirm = body != null ? body.confirm() : null;
        auth.withdraw(UUID.fromString(userId), pw, confirm);
        return ResponseEntity.noContent().build();
    }
}
