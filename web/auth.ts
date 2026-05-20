import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

// OAuth 키는 런타임 env: AUTH_GITHUB_ID/SECRET, AUTH_GOOGLE_ID/SECRET, AUTH_SECRET
// 키가 없으면 해당 provider 버튼이 동작하지 않을 뿐, 빌드/게스트 사용엔 영향 없음.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub, Google],
  session: { strategy: "jwt" },
});
