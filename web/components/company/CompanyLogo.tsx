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
  const src = domain ? logoUrl(domain) : "";
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
