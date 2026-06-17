package com.devjobs.profile;

import java.util.UUID;

/** 자동 닉네임 — handle 미설정 사용자의 결정적 표시명(동일 인물=동일 닉네임). 실명/이메일 노출 없음. */
public final class UserHandle {

    private UserHandle() {}

    private static final String[] ADJ = {
        "성실한", "꼼꼼한", "용감한", "차분한", "느긋한", "단단한", "산뜻한", "다정한", "묵직한", "재빠른"
    };
    private static final String[] NOUN = {
        "펭귄", "여우", "수달", "두더지", "고래", "올빼미", "다람쥐", "너구리", "고슴도치", "물범"
    };

    public static String generate(UUID userId) {
        int h = Math.abs(userId.hashCode());
        return ADJ[h % ADJ.length] + NOUN[(h / ADJ.length) % NOUN.length] + (h % 90 + 10);
    }
}
