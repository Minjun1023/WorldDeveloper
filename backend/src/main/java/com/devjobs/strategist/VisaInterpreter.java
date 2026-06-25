package com.devjobs.strategist;

import com.devjobs.scout.dto.JobDtos.VisaDto;

/**
 * 비자 확신도 해석 룰 — 공고의 VisaDto(상태/근거/명부검증)를 한국 지원자용 신뢰 신호로 변환.
 * 정부 명부 대조(registerVerified)가 가장 강한 신호이며, 그 외엔 status 키워드로 추론한다.
 */
public final class VisaInterpreter {
    private VisaInterpreter() {}

    public record VisaInsight(String confidence, String message) {}

    public static VisaInsight interpret(VisaDto v) {
        String status = v == null || v.status() == null ? "unclear" : v.status();
        boolean verified = v != null && v.registerVerified();
        if (verified) {
            return new VisaInsight("verified",
                "명부 검증(정부 명부 대조) — 가장 강한 신호. 한국에서 안심하고 지원하세요.");
        }
        return switch (status) {
            case "sponsors" -> new VisaInsight("likely",
                "스폰서 명시(공고 키워드 기반) — 가능성 높음. 지원 전 한 번 확인 권장.");
            case "no_sponsor" -> new VisaInsight("none",
                "스폰서 불가 명시 — 현지 작업권 없으면 지원 어려움.");
            default -> new VisaInsight("unclear",
                "비자 정책 미언급 — 지원 전 채용담당자에게 스폰서 여부 먼저 이메일로 문의하세요.");
        };
    }
}
