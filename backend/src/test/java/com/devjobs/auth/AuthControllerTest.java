package com.devjobs.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AuthControllerTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @MockBean MailService mailService;

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

    private String json(Map<String, ?> m) throws Exception { return om.writeValueAsString(m); }

    @Test
    void registerReturns200() throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", "ctrl-reg@example.com", "password", "Password123", "display_name", "C1"))))
            .andExpect(status().isOk());
    }

    @Test
    void loginUnverifiedReturns403() throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", "ctrl-unv@example.com", "password", "Password123", "display_name", "C2"))))
            .andExpect(status().isOk());
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", "ctrl-unv@example.com", "password", "Password123"))))
            .andExpect(status().isForbidden());
    }

    @Test
    void exchangeWithoutInternalSecretIsUnauthorized() throws Exception {
        mvc.perform(post("/api/v1/auth/exchange").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("code", "whatever"))))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void checkNameEndpoint() throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", "cn@example.com", "password", "Password123", "display_name", "TakenCtrl"))))
            .andExpect(status().isOk());
        mvc.perform(get("/api/v1/auth/check-name").param("name", "TakenCtrl"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.available").value(false));
        mvc.perform(get("/api/v1/auth/check-name").param("name", "FreshCtrl"))
            .andExpect(jsonPath("$.available").value(true));
    }

    @Test
    void checkEmailEndpoint() throws Exception {
        mvc.perform(get("/api/v1/auth/check-email").param("email", "bad"))
            .andExpect(jsonPath("$.valid").value(false));
        mvc.perform(get("/api/v1/auth/check-email").param("email", "free-ctrl@example.com"))
            .andExpect(jsonPath("$.valid").value(true))
            .andExpect(jsonPath("$.available").value(true));
    }
}
