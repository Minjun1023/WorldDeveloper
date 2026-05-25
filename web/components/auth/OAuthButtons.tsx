export function OAuthButtons({ backendPublicUrl }: { backendPublicUrl: string }) {
  return (
    <div className="flex flex-col gap-2">
      <a
        href={`${backendPublicUrl}/oauth2/authorization/github`}
        className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface text-body-sm font-medium hover:bg-muted transition-colors"
      >
        GitHub 계정으로 계속
      </a>
      <a
        href={`${backendPublicUrl}/oauth2/authorization/google`}
        className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface text-body-sm font-medium hover:bg-muted transition-colors"
      >
        Google 계정으로 계속
      </a>
    </div>
  );
}
