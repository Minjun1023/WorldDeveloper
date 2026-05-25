package com.devjobs.auth;

import com.devjobs.auth.dto.AuthDtos.AuthResult;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** OAuth 콜백 -> web 핸드오프: 60초·단회 코드를 발급/교환한다. */
@Service
public class OAuthHandoffService {

    private final OAuthHandoffCodeRepository repo;
    private final UserRepository userRepo;
    private final JwtService jwtService;

    public OAuthHandoffService(OAuthHandoffCodeRepository repo,
                               UserRepository userRepo,
                               JwtService jwtService) {
        this.repo = repo;
        this.userRepo = userRepo;
        this.jwtService = jwtService;
    }

    @Transactional
    public String createCode(String userId) {
        String raw = TokenHasher.randomToken();
        repo.save(new OAuthHandoffCodeEntity(
            TokenHasher.sha256Hex(raw), UUID.fromString(userId),
            OffsetDateTime.now().plusSeconds(60)));
        return raw;
    }

    @Transactional
    public AuthResult exchange(String rawCode) {
        OAuthHandoffCodeEntity c = repo.findByCodeHash(TokenHasher.sha256Hex(rawCode))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_code"));
        if (c.getConsumedAt() != null || c.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_code");
        }
        c.consume(OffsetDateTime.now());
        UserEntity u = userRepo.findById(c.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_code"));
        return new AuthResult(jwtService.issue(u.getId().toString()),
            u.getId().toString(), u.getEmail(), u.getDisplayName());
    }
}
