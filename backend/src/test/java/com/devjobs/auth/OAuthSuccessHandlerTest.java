package com.devjobs.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;

class OAuthSuccessHandlerTest {

    private MockHttpServletResponse runGoogleLogin(AuthService.OAuthUpsertResult upsertResult) throws Exception {
        AuthService auth = mock(AuthService.class);
        OAuthHandoffService handoff = mock(OAuthHandoffService.class);

        when(auth.oauthUpsert(eq("google"), eq("sub-1"), eq("g@example.com"), eq("G"))).thenReturn(upsertResult);
        when(handoff.createCode(upsertResult.user().getId().toString())).thenReturn("CODE123");

        OAuthSuccessHandler handler = new OAuthSuccessHandler(auth, handoff, "http://localhost:3000");

        DefaultOAuth2User principal = new DefaultOAuth2User(
            List.of(new SimpleGrantedAuthority("ROLE_USER")),
            Map.of("sub", "sub-1", "email", "g@example.com", "name", "G", "email_verified", Boolean.TRUE),
            "sub");
        OAuth2AuthenticationToken token =
            new OAuth2AuthenticationToken(principal, principal.getAuthorities(), "google");

        MockHttpServletRequest req = new MockHttpServletRequest();
        MockHttpServletResponse res = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(req, res, token);
        return res;
    }

    @Test
    void existingUserRedirectsToCallbackWithoutOnboarding() throws Exception {
        UserEntity user = new UserEntity("g@example.com", null, "G");
        MockHttpServletResponse res = runGoogleLogin(new AuthService.OAuthUpsertResult(user, false));
        assertEquals("http://localhost:3000/auth/callback?code=CODE123", res.getRedirectedUrl());
    }

    @Test
    void newUserRedirectsToCallbackWithOnboardingFlag() throws Exception {
        UserEntity user = new UserEntity("g@example.com", null, "G");
        MockHttpServletResponse res = runGoogleLogin(new AuthService.OAuthUpsertResult(user, true));
        assertEquals("http://localhost:3000/auth/callback?code=CODE123&onboarding=1", res.getRedirectedUrl());
    }
}
