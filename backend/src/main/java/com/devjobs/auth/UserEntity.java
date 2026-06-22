package com.devjobs.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
public class UserEntity {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "email_verified_at")
    private OffsetDateTime emailVerifiedAt;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    protected UserEntity() {}

    public UserEntity(String email, String passwordHash, String displayName) {
        this.id = UUID.randomUUID();
        this.email = email;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
        this.createdAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public OffsetDateTime getEmailVerifiedAt() { return emailVerifiedAt; }
    public String getDisplayName() { return displayName; }

    public void markEmailVerified(OffsetDateTime at) { this.emailVerifiedAt = at; }

    /** 비밀번호 재설정용. 호출부에서 PasswordEncoder 로 인코딩한 해시를 넘긴다. */
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
}
