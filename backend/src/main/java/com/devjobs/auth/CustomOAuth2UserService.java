package com.devjobs.auth;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * GitHub 은 primary email 이 비공개면 /userinfo 에 email 이 없다.
 * user:email 스코프로 /user/emails 를 조회해 verified primary email 을 attributes 에 보강한다.
 */
@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final RestClient restClient = RestClient.create();

    @Override
    public OAuth2User loadUser(OAuth2UserRequest req) throws OAuth2AuthenticationException {
        OAuth2User user = super.loadUser(req);
        String registrationId = req.getClientRegistration().getRegistrationId();

        if (!"github".equals(registrationId) || user.getAttribute("email") != null) {
            return user;
        }

        String primaryEmail = fetchGithubPrimaryEmail(req.getAccessToken().getTokenValue());
        if (primaryEmail == null) {
            return user;
        }

        Map<String, Object> merged = new HashMap<>(user.getAttributes());
        merged.put("email", primaryEmail);
        String nameAttrKey = req.getClientRegistration().getProviderDetails()
            .getUserInfoEndpoint().getUserNameAttributeName();
        return new DefaultOAuth2User(new ArrayList<>(user.getAuthorities()), merged, nameAttrKey);
    }

    private String fetchGithubPrimaryEmail(String accessToken) {
        List<Map<String, Object>> emails = restClient.get()
            .uri("https://api.github.com/user/emails")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
            .header("Accept", "application/vnd.github+json")
            .retrieve()
            .body(new ParameterizedTypeReference<List<Map<String, Object>>>() {});
        if (emails == null) return null;
        for (Map<String, Object> e : emails) {
            if (Boolean.TRUE.equals(e.get("primary")) && Boolean.TRUE.equals(e.get("verified"))) {
                return (String) e.get("email");
            }
        }
        return null;
    }
}
