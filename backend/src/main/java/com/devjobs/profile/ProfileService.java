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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {

    private final UserProfileRepository repo;

    public ProfileService(UserProfileRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public ProfileDto.ProfileResponse get(UUID userId) {
        Optional<UserProfileEntity> e = repo.findById(userId);
        if (e.isEmpty() || e.get().getSkills().isEmpty()) {
            return new ProfileDto.ProfileResponse(false, null);
        }
        return new ProfileDto.ProfileResponse(true, toDto(e.get()));
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
        e.setUpdatedAt(OffsetDateTime.now());
        repo.save(e);
    }

    @Transactional(readOnly = true)
    public Optional<UserProfileEntity> load(UUID userId) {
        return repo.findById(userId).filter(e -> !e.getSkills().isEmpty());
    }

    private ProfileDto.Profile toDto(UserProfileEntity e) {
        return new ProfileDto.Profile(e.getSkills(), e.getSeniority(), e.getYearsExperience(),
            e.getPreferredLocations(), e.getRemotePreference(), e.getDesiredSalaryUsd(), e.getBio());
    }

    public static RecommendRequest toRecommendRequest(UserProfileEntity e, AiClient.ParseResult.Profile note) {
        List<String> skills = union(e.getSkills(), note == null ? null : note.skills());
        List<String> locs = union(e.getPreferredLocations(), note == null ? null : note.preferredLocations());
        String seniority = note != null && note.seniority() != null ? note.seniority() : e.getSeniority();
        Integer years = note != null && note.yearsExperience() != null ? note.yearsExperience() : e.getYearsExperience();
        String remote = note != null && note.remotePreference() != null ? note.remotePreference() : e.getRemotePreference();
        Integer salary = note != null && note.desiredSalaryUsd() != null ? note.desiredSalaryUsd() : e.getDesiredSalaryUsd();
        return new RecommendRequest(
            skills, seniority, years, e.getBio(), null,
            true,
            locs, remote, salary, null, 9, 2);
    }

    private static List<String> union(List<String> a, List<String> b) {
        LinkedHashSet<String> set = new LinkedHashSet<>(a == null ? List.of() : a);
        if (b != null) set.addAll(b);
        return new ArrayList<>(set);
    }
}
