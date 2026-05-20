package com.devjobs;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * 전체 Spring context 가 정상 기동하는지 검증.
 * Testcontainers 로 실제 pgvector Postgres 를 띄워 Flyway 마이그레이션 + JPA validate 까지 통과해야 한다.
 * Docker 만 있으면 로컬·CI 동일하게 동작.
 */
@SpringBootTest
@Testcontainers
class ApplicationTests {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @Test
    void contextLoads() {
        // context 가 뜨면(= Flyway 적용 + 모든 빈 생성 + JPA validate) 통과
    }
}
