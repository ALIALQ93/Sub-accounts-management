import Link from "next/link";

interface OpenInNewTabLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function OpenInNewTabLink({
  href,
  children,
  className = "",
  title = "فتح في تبويب جديد",
}: OpenInNewTabLinkProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={className}
    >
      {children}
    </Link>
  );
}

interface DocumentActionLinksProps {
  href: string;
  openLabel?: string;
  newTabLabel?: string;
}

export function DocumentActionLinks({
  href,
  openLabel = "فتح",
  newTabLabel = "↗",
}: DocumentActionLinksProps) {
  const linkClass =
    "rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50";

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link href={href} className={linkClass}>
        {openLabel}
      </Link>
      <OpenInNewTabLink
        href={href}
        className={linkClass}
        title="فتح في تبويب جديد للمقارنة"
      >
        {newTabLabel}
      </OpenInNewTabLink>
    </div>
  );
}

export function buildUrlWithQuery(
  pathname: string,
  params: Record<string, string | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}
