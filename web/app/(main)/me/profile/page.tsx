import { ProfileEditor } from "@/components/profile/ProfileEditor";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-display">프로필</h1>
        <p className="mt-2 text-muted-foreground">
          선호조건을 채우면 맞춤 공고 추천에 쓰여요. (비자 스폰서십은 기본 포함)
        </p>
      </section>
      <ProfileEditor />
    </div>
  );
}
