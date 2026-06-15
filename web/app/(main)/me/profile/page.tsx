import { ProfileEditor } from "@/components/profile/ProfileEditor";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  // 제목·소개·완성도 칩은 ProfileEditor 헤더가 렌더(프로필 값이 필요해서 클라이언트로 이동).
  return <ProfileEditor />;
}
