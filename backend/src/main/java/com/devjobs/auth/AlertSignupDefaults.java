package com.devjobs.auth;

import com.devjobs.company.FavoriteCompanyAlertEntity;
import com.devjobs.company.FavoriteCompanyAlertRepository;
import com.devjobs.feedback.SavedJobCloseAlertEntity;
import com.devjobs.feedback.SavedJobCloseAlertRepository;
import com.devjobs.profile.ProfileMatchAlertEntity;
import com.devjobs.profile.ProfileMatchAlertRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 가입 시 이메일 알림 3종(관심 공고 마감·관심 기업 신규·맞춤 매칭)의 기본값 반영.
 * 정책(2026-07): 가입 동의창에서 기본 허용 — 이후 프로필 정보에서 개별 수신 거부.
 *
 * 저장 규칙(각 알림의 '행 없음' 기본값이 달라 필요한 행만 만든다):
 * - 허용: 옵트인형(match, 행 없음=꺼짐)만 켠 행 생성. saved/company 는 행 없음=켬이라 그대로.
 * - 거부: 옵트아웃형(saved/company)에 끈 행을 생성해 거부를 기록. match 는 행 없음=꺼짐 그대로.
 */
@Component
public class AlertSignupDefaults {

    private final ProfileMatchAlertRepository matchRepo;
    private final SavedJobCloseAlertRepository savedRepo;
    private final FavoriteCompanyAlertRepository companyRepo;

    public AlertSignupDefaults(ProfileMatchAlertRepository matchRepo,
                               SavedJobCloseAlertRepository savedRepo,
                               FavoriteCompanyAlertRepository companyRepo) {
        this.matchRepo = matchRepo;
        this.savedRepo = savedRepo;
        this.companyRepo = companyRepo;
    }

    @Transactional
    public void apply(UUID userId, boolean allow) {
        if (allow) {
            if (!matchRepo.existsById(userId)) {
                matchRepo.save(new ProfileMatchAlertEntity(userId, true));
            }
        } else {
            SavedJobCloseAlertEntity saved = savedRepo.findById(userId)
                .orElseGet(() -> new SavedJobCloseAlertEntity(userId));
            saved.setNotify(false);
            savedRepo.save(saved);
            FavoriteCompanyAlertEntity company = companyRepo.findById(userId)
                .orElseGet(() -> new FavoriteCompanyAlertEntity(userId));
            company.setNotify(false);
            companyRepo.save(company);
        }
    }
}
