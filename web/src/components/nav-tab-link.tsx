"use client";

import Link from "next/link";

interface NavTabLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  onNavigate?: () => void;
}

/** اسم ثابت لكل مسار — المتصفح يعيد استخدام نفس التبويب بدل فتح جديد */
export function navWindowName(href: string): string {
  try {
    const url = new URL(
      href,
      typeof window !== "undefined" ? window.location.origin : "https://local.invalid",
    );
    const key = `${url.pathname}${url.search}` || "/";
    const safe = key.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    return `sam-nav-${safe || "home"}`;
  } catch {
    return "sam-nav-home";
  }
}

export function NavTabLink({
  href,
  children,
  className = "",
  title,
  onNavigate,
}: NavTabLinkProps) {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onNavigate?.();
    if (typeof window === "undefined") return;

    event.preventDefault();
    const name = navWindowName(href);
    const absolute = new URL(href, window.location.href).href;
    const tab = window.open(absolute, name);
    tab?.focus();
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      title={title ?? "فتح القسم — أو الانتقال إليه إن كان مفتوحاً"}
      className={className}
    >
      {children}
    </Link>
  );
}
