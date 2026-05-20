package com.devjobs;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = {
    // skeleton 단계: DB 없이 web context 만 검증.
    // 실제 DB 통합 테스트는 Testcontainers 도입 시 별도 작성 (DESIGN.md W3+).
    "spring.autoconfigure.exclude="
        + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
        + "org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,"
        + "org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration",
    "spring.flyway.enabled=false"
})
class ApplicationTests {

    @Test
    void contextLoads() {
        // Spring web context 가 정상 로드되는지만 확인
    }
}
