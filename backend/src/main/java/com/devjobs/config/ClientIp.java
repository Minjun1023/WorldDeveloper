package com.devjobs.config;

import jakarta.servlet.http.HttpServletRequest;

/**
 * rate limit 키용 클라이언트 IP — 반드시 이 유틸만 사용한다.
 *
 * X-Forwarded-For 를 코드에서 직접 파싱하지 않는다: 직접 연결 클라이언트가 헤더를 위조해
 * IP 별 rate limit 을 무한 우회할 수 있었다(파싱 방식도 컨트롤러마다 제각각이었음).
 * 대신 server.forward-headers-strategy=framework 가 신뢰 프록시의 Forwarded 헤더를
 * 해석해 getRemoteAddr() 에 반영하므로, 여기서는 그것만 읽는다.
 */
public final class ClientIp {

    private ClientIp() {}

    public static String of(HttpServletRequest request) {
        String addr = request.getRemoteAddr();
        return addr == null ? "" : addr;
    }
}
