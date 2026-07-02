"use client";

import Image from "next/image";

interface CompanyLogoProps {
  companyName: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  priority?: boolean;
}

const SIZE = {
  sm: { box: "h-10 w-10", text: "text-base", img: 40 },
  md: { box: "h-16 w-16", text: "text-xl", img: 64 },
  lg: { box: "h-24 w-24", text: "text-3xl", img: 96 },
} as const;

function getInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "ش";
  return trimmed.charAt(0).toUpperCase();
}

function isExternalUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

export function CompanyLogo({
  companyName,
  logoUrl,
  size = "md",
  className = "",
  priority = false,
}: CompanyLogoProps) {
  const dimensions = SIZE[size];
  const trimmedUrl = logoUrl?.trim();

  if (trimmedUrl) {
    if (isExternalUrl(trimmedUrl)) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={trimmedUrl}
          alt={companyName}
          width={dimensions.img}
          height={dimensions.img}
          className={`${dimensions.box} shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1 ${className}`}
        />
      );
    }

    return (
      <Image
        src={trimmedUrl}
        alt={companyName}
        width={dimensions.img}
        height={dimensions.img}
        priority={priority}
        className={`${dimensions.box} shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${dimensions.box} flex shrink-0 items-center justify-center rounded-xl border border-[var(--brand-border)] bg-gradient-to-br from-[var(--brand-navy)] to-[var(--brand-navy-light)] font-bold text-white shadow-sm ${dimensions.text} ${className}`}
      aria-hidden
    >
      {getInitial(companyName)}
    </div>
  );
}
