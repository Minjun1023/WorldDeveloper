package com.devjobs.auth;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

/** OAuth 성공 -> 사용자 upsert -> 일회용 코드 -> web /auth/callback 리다이렉트. */
@Component
public class OAuthSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final AuthService auth;
    private final OAuthHandoffService handoff;
    private final String appBaseUrl;

    public OAuthSuccessHandler(AuthService auth,
                               OAuthHandoffService handoff,
                               @Value("${app.base-url}") String appBaseUrl) {
        this.auth = auth;
        this.handoff = handoff;
        this.appBaseUrl = appBaseUrl;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) authentication;
        String provider = token.getAuthorizedClientRegistrationId();
        OAuth2User u = token.getPrincipal();

        String sub;
        String email;
        String name;
        if ("github".equals(provider)) {
            Object id = u.getAttribute("id");
            sub = String.valueOf(id);
            email = u.getAttribute("email");
            name = u.getAttribute("name") != null ? u.getAttribute("name") : u.getAttribute("login");
        } else { // google (oidc)
            sub = u.getAttribute("sub");
            email = u.getAttribute("email");
            name = u.getAttribute("name");
            Object emailVerified = u.getAttribute("email_verified");
            if (!Boolean.TRUE.equals(emailVerified) && !"true".equals(String.valueOf(emailVerified))) {
                getRedirectStrategy().sendRedirect(request, response, appBaseUrl + "/signin?error=email_unverified");
                return;
            }
        }

        AuthService.OAuthUpsertResult result = auth.oauthUpsert(provider, sub, email, name);
        String code = handoff.createCode(result.user().getId().toString());
        // 신규 가입자는 프로필 온보딩을 1회 보여주도록 web 콜백에 신호를 전달한다(기존 사용자는 홈으로).
        String onboarding = result.newAccount() ? "&onboarding=1" : "";
        getRedirectStrategy().sendRedirect(request, response,
            appBaseUrl + "/auth/callback?code=" + code + onboarding);
    }
}
