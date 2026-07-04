import { ProfileEditor } from "@/components/profile/ProfileEditor";

export const dynamic = "force-dynamic";

export default function ProfilePage({
  searchParams,
}: {
  searchParams: { welcome?: string };
}) {
  // 제목·소개·완성도 칩은 ProfileEditor 헤더가 렌더(프로필 값이 필요해서 클라이언트로 이동).
  // welcome=1: 가입 직후 환영 모드 — 배너 + 저장 시 /recommend 로 이동(첫 가치 경험).
  return <ProfileEditor welcome={searchParams.welcome === "1"} />;
}
