import { z } from "zod";

/**
 * 회원 프로필 계약 (웹 ↔ Spring 백엔드, snake_case).
 * 백엔드 ProfileDto.Profile 및 web RecommendProfile 의 프로필 항목과 동일해야 한다.
 * skills/seniority 는 항상 존재, 나머지(bio 포함)는 미설정 시 생략(Jackson non_null)되므로 nullish.
 */
export const recommendProfileSchema = z.object({
  skills: z.array(z.string()),
  seniority: z.string(),
  bio: z.string().nullish(),
  handle: z.string().nullish(), // 커뮤니티 닉네임(미설정 시 자동)
  years_experience: z.number().int().min(0).max(80).nullish(),
  preferred_locations: z.array(z.string()).nullish(),
  remote_preference: z.string().nullish(),
  desired_salary_usd: z.number().int().min(0).nullish(),
});

export type RecommendProfileData = z.infer<typeof recommendProfileSchema>;

/** GET /api/v1/me/profile 응답: 프로필 없음이면 exists=false 이고 profile 생략. nickname 은 항상. */
export const profileResponseSchema = z.object({
  exists: z.boolean(),
  profile: recommendProfileSchema.nullish(),
  nickname: z.string().nullish(),
});

export type ProfileResponseData = z.infer<typeof profileResponseSchema>;
