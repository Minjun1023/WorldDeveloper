package com.devjobs.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * MVP 단계 보안: 게스트 트래픽은 모두 허용, /api/v1/me/** 만 인증 필요.
 * NextAuth JWT 검증 필터는 v0.7 에서 추가 (DESIGN.md 5.3).
 */
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/me/**").authenticated()
                .anyRequest().permitAll()
            );
        return http.build();
    }
}
