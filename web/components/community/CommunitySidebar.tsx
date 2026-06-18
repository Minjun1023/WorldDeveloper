import { Building2, FileText, Stamp } from "lucide-react";
import Link from "next/link";

import { fetchCommunityPosts } from "@/lib/community";

// 목록·상세가 공유하는 우측 사이드바: 인기 글 + 준비 가이드. (서버 컴포넌트, 인기글 자체 페치)
const GUIDES = [
  { href: "/visa", icon: Stamp, label: "비자 가이드", desc: "국가별 비자·스폰서십" },
  { href: "/companies", icon: Building2, label: "회사 정보", desc: "명부 검증 회사·업종" },
  { href: "/coach", icon: FileText, label: "이력서 코치", desc: "공고 맞춤 1:1 상담" },
];

export async function CommunitySidebar() {
  const popular = (await fetchCommunityPosts({ sort: "top" })).items.slice(0, 5);
  return (
    <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
      {popular.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-body-sm font-semibold text-foreground">인기 글</h2>
          <ul className="mt-3 space-y-2.5">
            {popular.map((p, i) => (
              <li key={p.id}>
                <Link href={`/community/${p.id}`} className="group flex gap-2">
                  <span className="text-caption font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="line-clamp-2 text-body-sm text-muted-foreground transition-colors group-hover:text-foreground">{p.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-body-sm font-semibold text-foreground">준비에 도움되는 것</h2>
        <ul className="mt-2 space-y-0.5">
          {GUIDES.map((g) => {
            const Icon = g.icon;
            return (
              <li key={g.href}>
                <Link href={g.href} className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-accent">
                  <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-body-sm font-medium text-foreground">{g.label}</span>
                    <span className="block text-caption text-muted-foreground">{g.desc}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
