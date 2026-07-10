package com.devjobs.profile;

import com.devjobs.auth.UserEntity;
import com.devjobs.auth.UserRepository;
import com.devjobs.strategist.AiClient;
import com.devjobs.strategist.dto.RecommendDtos.RecommendRequest;
import com.devjobs.profile.dto.ProfileDto;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProfileService {

    // 닉네임: 2~20자, 한글/영문/숫자/_/- (공백·특수문자 불가). '익명' 류는 예약어로 금지.
    private static final Pattern HANDLE_RE = Pattern.compile("^[\\p{L}\\p{N}_-]{2,20}$");

    private final UserProfileRepository repo;
    private final UserRepository userRepo;

    public ProfileService(UserProfileRepository repo, UserRepository userRepo) {
        this.repo = repo;
        this.userRepo = userRepo;
    }

    @Transactional(readOnly = true)
    public ProfileDto.ProfileResponse get(UUID userId) {
        Optional<UserProfileEntity> e = repo.findById(userId);
        String nickname = resolveNickname(userId, e.orElse(null));
        if (e.isEmpty() || e.get().getSkills().isEmpty()) {
            return new ProfileDto.ProfileResponse(false, null, nickname);
        }
        return new ProfileDto.ProfileResponse(true, toDto(e.get()), nickname);
    }

    /**
     * 표시 닉네임 결정: 커스텀 핸들(직접 설정) → 실명(가입/소셜로그인 displayName) → 자동 닉네임.
     * 실명이 있으면(소셜·이메일 가입 모두) 그대로 노출하고, 이름이 아예 없을 때만 익명 닉네임으로 폴백한다.
     */
    private String resolveNickname(UUID userId, UserProfileEntity profile) {
        String handle = profile != null ? profile.getHandle() : null;
        String displayName = userRepo.findById(userId).map(UserEntity::getDisplayName).orElse(null);
        return firstNonBlank(handle, displayName, UserHandle.generate(userId));
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null; // UserHandle.generate 는 항상 non-blank 라 도달하지 않음
    }

    // 입력 상한 — 무제한 배열/텍스트 저장(행 비대·저장 폭탄) 방지. 실사용 최대치의 넉넉한 배수.
    private static final int MAX_SKILLS = 50;
    private static final int MAX_LOCATIONS = 30;
    private static final int MAX_ITEM_LEN = 60;   // 스킬·지역 항목 하나의 길이
    private static final int MAX_BIO_LEN = 1000;

    @Transactional
    public void upsert(UUID userId, ProfileDto.Profile p) {
        UserProfileEntity e = repo.findById(userId).orElseGet(() -> new UserProfileEntity(userId));
        e.setSkills(capList(p.skills(), MAX_SKILLS));
        e.setSeniority(p.seniority());
        e.setYearsExperience(p.yearsExperience());
        e.setPreferredLocations(capList(p.preferredLocations(), MAX_LOCATIONS));
        e.setRemotePreference(p.remotePreference());
        e.setDesiredSalaryUsd(p.desiredSalaryUsd());
        e.setBio(capText(p.bio(), MAX_BIO_LEN));
        e.setHandle(normalizeHandle(userId, p.handle()));
        e.setUpdatedAt(OffsetDateTime.now());
        repo.save(e);
    }

    /** 리스트 상한 + 항목별 길이 상한 (초과분은 조용히 절단 — 프로필 저장은 관용적으로). */
    private static List<String> capList(List<String> in, int maxItems) {
        if (in == null) return List.of();
        return in.stream()
            .filter(s -> s != null && !s.isBlank())
            .map(s -> capText(s.trim(), MAX_ITEM_LEN))
            .limit(maxItems)
            .toList();
    }

    private static String capText(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    /** 닉네임 정규화·검증. 빈 값이면 null(자동 닉네임). 형식 오류 400, 중복 409. */
    private String normalizeHandle(UUID userId, String raw) {
        if (raw == null) return null;
        String h = raw.trim();
        if (h.isEmpty()) return null;
        if (!HANDLE_RE.matcher(h).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "닉네임은 2~20자의 한글·영문·숫자·_·- 만 가능해요");
        }
        if (h.equalsIgnoreCase("익명") || h.equalsIgnoreCase("anonymous")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "사용할 수 없는 닉네임이에요");
        }
        if (repo.existsByHandleIgnoreCaseAndUserIdNot(h, userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 사용 중인 닉네임이에요");
        }
        return h;
    }

    @Transactional(readOnly = true)
    public Optional<UserProfileEntity> load(UUID userId) {
        return repo.findById(userId).filter(e -> !e.getSkills().isEmpty());
    }

    private ProfileDto.Profile toDto(UserProfileEntity e) {
        return new ProfileDto.Profile(e.getSkills(), e.getSeniority(), e.getYearsExperience(),
            e.getPreferredLocations(), e.getRemotePreference(), e.getDesiredSalaryUsd(), e.getBio(), e.getHandle());
    }

    /** 기본 topK(9) — 기존 호출처/테스트 호환용. */
    public static RecommendRequest toRecommendRequest(UserProfileEntity e, AiClient.ParseResult.Profile note) {
        return toRecommendRequest(e, note, DEFAULT_TOP_K);
    }

    public static final int DEFAULT_TOP_K = 9;
    public static final int MAX_TOP_K = 30;

    public static RecommendRequest toRecommendRequest(
            UserProfileEntity e, AiClient.ParseResult.Profile note, int topK) {
        List<String> skills = union(e.getSkills(), note == null ? null : note.skills());
        List<String> locs = union(e.getPreferredLocations(), note == null ? null : note.preferredLocations());
        String seniority = note != null && note.seniority() != null ? note.seniority() : e.getSeniority();
        Integer years = note != null && note.yearsExperience() != null ? note.yearsExperience() : e.getYearsExperience();
        String remote = note != null && note.remotePreference() != null ? note.remotePreference() : e.getRemotePreference();
        Integer salary = note != null && note.desiredSalaryUsd() != null ? note.desiredSalaryUsd() : e.getDesiredSalaryUsd();
        int safeTopK = Math.min(Math.max(1, topK), MAX_TOP_K);
        return new RecommendRequest(
            skills, seniority, years, e.getBio(), null,
            true,
            locs, remote, salary, null, safeTopK, 2);
    }

    private static List<String> union(List<String> a, List<String> b) {
        LinkedHashSet<String> set = new LinkedHashSet<>(a == null ? List.of() : a);
        if (b != null) set.addAll(b);
        return new ArrayList<>(set);
    }
}
