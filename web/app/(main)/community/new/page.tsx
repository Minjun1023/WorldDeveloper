import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PostComposer } from "@/components/community/PostComposer";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/session-server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function CommunityNewPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/community" className="inline-flex items-center gap-1 text-body-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        라운지로
      </Link>
      <h1 className="text-h1">글쓰기</h1>

      {session ? (
        <PostComposer
          defaultCategory={str(searchParams.category)}
          linkedCompanySlug={str(searchParams.company)}
          linkedJobId={str(searchParams.jobId)}
          linkedCountry={str(searchParams.country)}
        />
      ) : (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-body-sm text-muted-foreground">로그인하면 글을 쓸 수 있어요.</p>
          <Link href="/signin?callbackUrl=/community/new" className={cn(buttonVariants(), "mt-3")}>
            로그인
          </Link>
        </div>
      )}
    </div>
  );
}
