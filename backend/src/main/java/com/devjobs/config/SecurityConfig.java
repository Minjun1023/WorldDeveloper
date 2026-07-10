package com.devjobs.config;

import com.devjobs.auth.CustomOAuth2UserService;
import com.devjobs.auth.OAuthSuccessHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * 게스트 트래픽(검색·추천·회사)은 허용, 지원 추적(/applications)은 JWT 인증 필요.
 * JwtAuthFilter 가 Bearer 토큰을 검증해 SecurityContext 에 user_id 주입 (DESIGN.md 5.3).
 */
@Configuration
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final CustomOAuth2UserService oAuth2UserService;
    private final OAuthSuccessHandler oAuthSuccessHandler;
    private final String appBaseUrl;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter,
                          CustomOAuth2UserService oAuth2UserService,
                          OAuthSuccessHandler oAuthSuccessHandler,
                          @Value("${app.base-url}") String appBaseUrl) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.oAuth2UserService = oAuth2UserService;
        this.oAuthSuccessHandler = oAuthSuccessHandler;
        this.appBaseUrl = appBaseUrl;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            // API 는 JwtAuthFilter(Bearer)로 무상태 인증. 세션은 OAuth2 인가요청 왕복에만 일시적으로 사용된다.
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                .requestMatchers("/api/v1/recommend/me", "/api/v1/recommend/me/**").authenticated()
                .requestMatchers("/api/v1/applications/**", "/api/v1/me/**").authenticated()
                // 분석: 조회 기록(view)은 비로그인 허용, 요약(summary)은 인증(컨트롤러서 admin 화이트리스트).
                .requestMatchers(HttpMethod.POST, "/api/v1/analytics/view/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/analytics/summary").authenticated()
                .anyRequest().permitAll()
            )
            .oauth2Login(oauth -> oauth
                .userInfoEndpoint(ui -> ui.userService(oAuth2UserService))
                .successHandler(oAuthSuccessHandler)
                .failureUrl(appBaseUrl + "/signin?error=oauth")
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
