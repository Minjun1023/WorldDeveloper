package com.devjobs.profile;

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

    public ProfileService(UserProfileRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public ProfileDto.ProfileResponse get(UUID userId) {
        Optional<UserProfileEntity> e = repo.findById(userId);
        String stored = e.map(UserProfileEntity::getHandle).orElse(null);
        String communityHandle = (stored != null && !stored.isBlank()) ? stored : UserHandle.generate(userId);
        if (e.isEmpty() || e.get().getSkills().isEmpty()) {
            return new ProfileDto.ProfileResponse(false, null, communityHandle);
        }
        return new ProfileDto.ProfileResponse(true, toDto(e.get()), communityHandle);
    }

    @Transactional
    public void upsert(UUID userId, ProfileDto.Profile p) {
        UserProfileEntity e = repo.findById(userId).orElseGet(() -> new UserProfileEntity(userId));
        e.setSkills(p.skills() == null ? List.of() : p.skills());
        e.setSeniority(p.seniority());
        e.setYearsExperience(p.yearsExperience());
        e.setPreferredLocations(p.preferredLocations() == null ? List.of() : p.preferredLocations());
        e.setRemotePreference(p.remotePreference());
        e.setDesiredSalaryUsd(p.desiredSalaryUsd());
        e.setBio(p.bio());
        e.setHandle(normalizeHandle(userId, p.handle()));
        e.setUpdatedAt(OffsetDateTime.now());
        repo.save(e);
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
