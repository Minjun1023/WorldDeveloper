package com.devjobs.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * 데모 계정 시드(R__seed_demo_account.sql)의 BCrypt 해시가 README·시드 주석에 문서화된
 * 비밀번호와 실제로 일치하는지 가드한다. 해시를 잘못 넣거나 비밀번호만 바꾸면(둘이 어긋나면)
 * 리뷰어가 로그인 못 하는 채로 배포되는데, 이 테스트가 그 상태를 미리 잡는다(순수 단위).
 */
class DemoAccountSeedTest {

    // 시드/문서에 공개된 데모 로그인 — 여기 바꾸면 R__seed_demo_account.sql 과 README 도 함께.
    private static final String DEMO_PASSWORD = "DevPass2026";

    @Test
    void seededHashMatchesDocumentedPassword() throws Exception {
        String sql = new String(
            getClass().getResourceAsStream("/db/migration/R__seed_demo_account.sql").readAllBytes(),
            StandardCharsets.UTF_8);

        // 완전한 BCrypt 해시($2x$NN$ + salt·hash 53자)만 매칭 — 주석의 'BCrypt($2a$10)' 같은
        // 부분 문자열에 걸리지 않도록 전체 형식을 요구한다.
        Matcher m = Pattern.compile("\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{53}").matcher(sql);
        assertThat(m.find()).as("시드 SQL 에서 BCrypt 해시를 찾지 못함").isTrue();
        String hash = m.group();

        assertThat(new BCryptPasswordEncoder().matches(DEMO_PASSWORD, hash))
            .as("시드 해시가 문서화된 데모 비밀번호와 불일치")
            .isTrue();
    }
}
