package com.devjobs.auth;

import java.util.regex.Pattern;

/** 간단한 이메일 형식 검증 (register + check-email 공유). */
public final class EmailFormat {

    private EmailFormat() {}

    private static final Pattern RE = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    public static boolean isValid(String email) {
        return email != null && RE.matcher(email.trim()).matches();
    }
}
