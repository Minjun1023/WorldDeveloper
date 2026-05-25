import Link from "next/link";

import { getSession } from "@/lib/session-server";

export async function UserMenu() {
  const session = await getSession();
  if (!session) {
    return (
      <Link href="/signin" className="hover:text-foreground transition-colors">
        로그인
      </Link>
    );
  }
  return (
    <form action="/api/auth/logout" method="post">
      <button type="submit" className="hover:text-foreground transition-colors">
        로그아웃
      </button>
    </form>
  );
}
