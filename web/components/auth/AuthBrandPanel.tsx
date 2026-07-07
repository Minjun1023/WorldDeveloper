import { BarChart3, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/BrandMark";

// 로그인/회원가입 좌측 그라데이션 브랜드 패널 (모바일에선 숨김). 일러스트는 제외.
// 로고는 홈(/)으로 가는 출구 역할.
const FEATURES = [
  { icon: ShieldCheck, label: "비자 스폰서 공고 추천" },
  { icon: BarChart3, label: "5축 점수로 매칭 분석" },
  { icon: Sparkles, label: "AI 이력서 코치 무료" },
];

export function AuthBrandPanel({ heading, subtitle }: { heading: string; subtitle: string }) {
  return (
    <div className="hidden flex-col gap-10 bg-primary p-10 text-white md:flex lg:p-12">
      <Link href="/" className="flex w-fit items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
          <BrandMark className="h-[18px] w-[18px]" />
        </span>
        <span className="text-lg font-bold tracking-tight">DevPass</span>
      </Link>
      <div>
        <h2 className="text-display text-white">{heading}</h2>
        <p className="mt-3 text-white/80">{subtitle}</p>
      </div>
      <ul className="space-y-4">
        {FEATURES.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-body-sm">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
