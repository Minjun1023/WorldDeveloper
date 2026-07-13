package com.devjobs.credits;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

/** 사용자×종류(kind)별 AI 크레딧 일일 사용량. 복합키(user_id, kind) — coach_conversations 패턴. */
@Entity
@Table(name = "user_ai_credits")
@IdClass(UserAiCreditEntity.Key.class)
public class UserAiCreditEntity {

    @Id
    private UUID userId;

    @Id
    private String kind;

    private LocalDate day;

    private int used;

    protected UserAiCreditEntity() {}

    public UUID getUserId() {
        return userId;
    }

    public String getKind() {
        return kind;
    }

    public LocalDate getDay() {
        return day;
    }

    public int getUsed() {
        return used;
    }

    public static class Key implements Serializable {
        private UUID userId;
        private String kind;

        public Key() {}

        public Key(UUID userId, String kind) {
            this.userId = userId;
            this.kind = kind;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Key k)) return false;
            return Objects.equals(userId, k.userId) && Objects.equals(kind, k.kind);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, kind);
        }
    }
}
