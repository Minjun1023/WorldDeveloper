package com.devjobs.strategist;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public final class NlCacheKey {

    private NlCacheKey() {}

    public static String normalize(String text) {
        return text.trim().toLowerCase().replaceAll("\\s+", " ");
    }

    public static String hash(String text) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(normalize(text).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
