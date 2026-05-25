package com.devjobs.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Spring 이 단독 발급하는 세션 JWT (HS256, JwtAuthFilter 와 동일 시크릿). */
@Service
public class JwtService {

    private final SecretKey key;
    private final long ttlDays;

    public JwtService(@Value("${jwt.secret}") String secret,
                      @Value("${auth.session-ttl-days:7}") long ttlDays) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttlDays = ttlDays;
    }

    public String issue(String userId) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(userId)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(Duration.ofDays(ttlDays))))
            .signWith(key)
            .compact();
    }
}
