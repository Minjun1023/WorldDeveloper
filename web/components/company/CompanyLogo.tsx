"use client";

import { useState } from "react";

import { colorFromName, initials, logoUrl, slugToDomain } from "@/lib/logo";

export function CompanyLogo({
  slug,
  name,
  size = 36,
}: {
  slug?: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const domain = slugToDomain(slug);
  // 토큰(logo.dev) 있을 때만 외부 로고 시도. 없으면 DuckDuckGo 가 무명 도메인에 빈 아이콘을
  // "성공"으로 반환해 onError 폴백이 안 떠서 깨져 보이므로, 토큰 없으면 바로 이니셜 아바타로 간다.
  const hasLogoToken = !!process.env.NEXT_PUBLIC_LOGODEV_TOKEN;
  const src = domain && hasLogoToken ? logoUrl(domain) : "";
  const dim = { width: size, height: size };

  if (!src || failed) {
    return (
      <span
        aria-hidden
        style={{ ...dim, backgroundColor: colorFromName(name) }}
        className="flex shrink-0 items-center justify-center rounded-md text-caption font-semibold text-white"
      >
        {initials(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${name} 로고`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      style={dim}
      className="shrink-0 rounded-md bg-muted object-contain"
    />
  );
}
