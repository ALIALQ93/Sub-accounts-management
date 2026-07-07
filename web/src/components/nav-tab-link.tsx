import Link from "next/link";

interface NavTabLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  onNavigate?: () => void;
}

export function NavTabLink({
  href,
  children,
  className = "",
  title,
  onNavigate,
}: NavTabLinkProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? "فتح في تبويب جديد"}
      className={className}
      onClick={onNavigate}
    >
      {children}
    </Link>
  );
}
