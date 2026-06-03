import { ProfileEditor } from "@/components/profile/ProfileEditor";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section>
        <h1 className="text-display">내 프로필</h1>
        <p className="mt-2 text-muted-foreground">
          기술스택·경력·선호 조건을 저장하면 맞춤 공고 추천에 쓰여요. (비자 스폰서십은 기본 포함)
        </p>
      </section>
      <ProfileEditor />
    </div>
  );
}
