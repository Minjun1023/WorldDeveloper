import { redirect } from "next/navigation";

// 별도 온보딩 페이지 폐기 — 완성형 프로필 편집(/me/profile)의 환영 모드로 통합.
// 구 링크(메일·북마크) 호환을 위해 라우트는 리다이렉트로 유지한다.
export default function OnboardingProfilePage() {
  redirect("/me/profile?welcome=1");
}
