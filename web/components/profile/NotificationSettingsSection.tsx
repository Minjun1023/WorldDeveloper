import { AlertToggleCard } from "@/components/alerts/AlertToggleCard";

// 프로필 계정 관리: 이메일 알림 3종을 한곳에서 승인/거부.
// 가입 동의창에서 기본 허용으로 시작하고, 여기서 개별 수신 거부한다(각 목록 페이지의 토글과 같은 설정).
export function NotificationSettingsSection() {
  return (
    <div className="mt-10 rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-body font-semibold">이메일 알림</h2>
      <p className="mb-4 mt-1 text-body-sm text-muted-foreground">
        받고 싶지 않은 알림은 여기서 끌 수 있어요. 메일 하단의 수신거부 링크로도 꺼져요.
      </p>
      <AlertToggleCard
        endpoint="/api/me/saved-job-alerts"
        title="관심 공고 알림"
        description="저장한 공고가 마감 임박이면 이메일로 알려드려요."
      />
      <AlertToggleCard
        endpoint="/api/me/company-alerts"
        title="관심 기업 알림"
        description="관심 기업에 새 공고가 올라오면 이메일로 알려드려요."
      />
      <AlertToggleCard
        endpoint="/api/me/match-alerts"
        title="맞춤 공고 알림"
        description="프로필과 잘 맞는 새 공고가 올라오면 이메일로 알려드려요."
        defaultOn={false}
      />
    </div>
  );
}
