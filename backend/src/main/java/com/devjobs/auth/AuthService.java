package com.devjobs.auth;

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.devjobs.auth.dto.AuthDtos.AuthResult;

@Service
public class AuthService {

    private final UserRepository userRepo;
    private final UserIdentityRepository identityRepo;
    private final EmailVerificationTokenRepository tokenRepo;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final JwtService jwtService;
    private final String appBaseUrl;

    public AuthService(UserRepository userRepo,
                       UserIdentityRepository identityRepo,
                       EmailVerificationTokenRepository tokenRepo,
                       PasswordEncoder passwordEncoder,
                       MailService mailService,
                       JwtService jwtService,
                       @Value("${app.base-url}") String appBaseUrl) {
        this.userRepo = userRepo;
        this.identityRepo = identityRepo;
        this.tokenRepo = tokenRepo;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
        this.jwtService = jwtService;
        this.appBaseUrl = appBaseUrl;
    }

    private static String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public UUID register(String email, String rawPassword, String displayName) {
        PasswordPolicy.validate(rawPassword);
        if (!EmailFormat.isValid(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_email");
        }
        String name = displayName == null ? null : displayName.trim();
        if (name != null && !name.isEmpty() && userRepo.existsByDisplayNameIgnoreCase(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "name_taken");
        }
        String norm = normalize(email);
        if (userRepo.existsByEmail(norm)) {
            return null; // 계정 열거 방지 + 기존 계정에 프로필이 덮어써지지 않도록 조용히 null 반환
        }
        UserEntity u = new UserEntity(norm, passwordEncoder.encode(rawPassword), name);
        userRepo.save(u);
        issueAndSendVerification(u);
        return u.getId();
    }

    /** 표시이름 사용 가능 여부 (비어있지 않고 중복 아님). */
    @Transactional(readOnly = true)
    public boolean isDisplayNameAvailable(String displayName) {
        String n = displayName == null ? "" : displayName.trim();
        return !n.isEmpty() && !userRepo.existsByDisplayNameIgnoreCase(n);
    }

    /** 이메일 형식 유효성 + 사용 가능 여부. */
    @Transactional(readOnly = true)
    public EmailAvailability checkEmail(String email) {
        boolean valid = EmailFormat.isValid(email);
        boolean available = valid && !userRepo.existsByEmail(normalize(email));
        return new EmailAvailability(valid, available);
    }

    public record EmailAvailability(boolean valid, boolean available) {}

    private static final String P_VERIFY = "verify";
    private static final String P_RESET = "reset";

    private void issueAndSendVerification(UserEntity u) {
        String code = TokenHasher.randomCode();
        EmailVerificationTokenEntity t = new EmailVerificationTokenEntity(
            u.getId(), TokenHasher.sha256Hex(code), P_VERIFY, OffsetDateTime.now().plusMinutes(10));
        tokenRepo.save(t);
        mailService.sendVerificationCode(u.getEmail(), code);
    }

    @Transactional
    public void resendVerification(String email) {
        Optional<UserEntity> ou = userRepo.findByEmail(normalize(email));
        if (ou.isEmpty()) return;                       // 열거 방지
        UserEntity u = ou.get();
        if (u.getEmailVerifiedAt() != null) return;     // 이미 인증됨
        if (u.getPasswordHash() == null) return;         // OAuth 전용 계정 — 해당 없음
        tokenRepo.deleteByUserIdAndPurpose(u.getId(), P_VERIFY);  // 이전 verify 토큰만 정리
        issueAndSendVerification(u);
    }

    /** 이메일 + 6자리 인증번호로 검증. 코드 단위 단회용(소비 시 재사용 불가). */
    @Transactional
    public void verifyEmail(String email, String rawCode) {
        UserEntity u = userRepo.findByEmail(normalize(email))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_code"));
        EmailVerificationTokenEntity t = tokenRepo
            .findByUserIdAndTokenHashAndPurpose(u.getId(), TokenHasher.sha256Hex(rawCode), P_VERIFY)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_code"));
        if (t.getConsumedAt() != null || t.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_code");
        }
        u.markEmailVerified(OffsetDateTime.now());
        t.consume(OffsetDateTime.now());
    }

    /** 비밀번호 재설정 코드 발송. 계정 열거 방지를 위해 미존재·OAuth전용이어도 조용히 성공 처리. */
    @Transactional
    public void requestPasswordReset(String email) {
        Optional<UserEntity> ou = userRepo.findByEmail(normalize(email));
        if (ou.isEmpty()) return;                       // 열거 방지
        UserEntity u = ou.get();
        if (u.getPasswordHash() == null) return;         // OAuth 전용 계정 — 비번 없음
        tokenRepo.deleteByUserIdAndPurpose(u.getId(), P_RESET);
        String code = TokenHasher.randomCode();
        tokenRepo.save(new EmailVerificationTokenEntity(
            u.getId(), TokenHasher.sha256Hex(code), P_RESET, OffsetDateTime.now().plusMinutes(10)));
        mailService.sendPasswordResetCode(u.getEmail(), code);
    }

    /** 이메일+6자리 코드로 비밀번호 재설정. 코드 단회용. 성공 시 해당 사용자의 reset 토큰 정리. */
    @Transactional
    public void resetPassword(String email, String rawCode, String newPassword) {
        PasswordPolicy.validate(newPassword);
        UserEntity u = userRepo.findByEmail(normalize(email))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_code"));
        EmailVerificationTokenEntity t = tokenRepo
            .findByUserIdAndTokenHashAndPurpose(u.getId(), TokenHasher.sha256Hex(rawCode), P_RESET)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_code"));
        if (t.getConsumedAt() != null || t.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_code");
        }
        u.setPasswordHash(passwordEncoder.encode(newPassword));
        u.markEmailVerified(OffsetDateTime.now()); // 코드로 이메일 소유를 증명했으니 미인증이면 함께 인증 처리
        t.consume(OffsetDateTime.now());
    }

    /**
     * 회원탈퇴. 비번 계정은 현재 비번 재확인, OAuth 전용 계정은 'DELETE' 확인 문자열을 요구한다.
     * users 행만 삭제하면 연관 데이터는 FK ON DELETE CASCADE 로 정리된다(job_views 는 SET NULL).
     */
    @Transactional
    public void withdraw(UUID userId, String confirmPassword, String confirmText) {
        UserEntity u = userRepo.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "user_not_found"));
        if (u.getPasswordHash() != null) {
            if (confirmPassword == null || !passwordEncoder.matches(confirmPassword, u.getPasswordHash())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "invalid_password");
            }
        } else {
            if (!"DELETE".equals(confirmText)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "confirm_required");
            }
        }
        userRepo.delete(u);
    }

    @Transactional(readOnly = true)
    public AuthResult login(String email, String rawPassword) {
        UserEntity u = userRepo.findByEmail(normalize(email))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid_credentials"));
        if (u.getPasswordHash() == null || !passwordEncoder.matches(rawPassword, u.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid_credentials");
        }
        if (u.getEmailVerifiedAt() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "email_not_verified");
        }
        String token = jwtService.issue(u.getId().toString());
        return new AuthResult(token, u.getId().toString(), u.getEmail(), u.getDisplayName());
    }

    /**
     * OAuth 로그인 결과. {@code newAccount} 는 이 호출로 계정이 새로 만들어졌는지를 가리킨다
     * (기존 provider 재로그인·기존 이메일에 provider 연결은 false). 신규 가입자에게만 프로필 온보딩을 보여주는 데 쓴다.
     */
    public record OAuthUpsertResult(UserEntity user, boolean newAccount) {}

    @Transactional
    public OAuthUpsertResult oauthUpsert(String provider, String providerSub, String email, String displayName) {
        Optional<UserIdentityEntity> existingIdentity =
            identityRepo.findByProviderAndProviderSub(provider, providerSub);
        if (existingIdentity.isPresent()) {
            UserEntity existing = userRepo.findById(existingIdentity.get().getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "user_missing"));
            return new OAuthUpsertResult(existing, false);
        }
        String norm = normalize(email);
        if (norm == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "oauth_email_required");
        }
        UserEntity user = userRepo.findByEmail(norm).orElse(null);
        boolean newAccount = user == null;
        if (newAccount) {
            user = new UserEntity(norm, null, displayName); // OAuth 전용: password_hash = null
            user.markEmailVerified(OffsetDateTime.now());    // 공급자 검증분
            userRepo.save(user);
        }
        identityRepo.save(new UserIdentityEntity(user.getId(), provider, providerSub));
        return new OAuthUpsertResult(user, newAccount);
    }
}
