import Link from "next/link";
import { APP_BRANDING } from "@/config/app-branding";

interface AppBrandFooterProps {
  compact?: boolean;
  theme?: "light" | "dark";
  className?: string;
}

export function AppBrandFooter({
  compact = false,
  theme = "light",
  className = "",
}: AppBrandFooterProps) {
  const year = new Date().getFullYear();
  const isDark = theme === "dark";

  return (
    <footer
      className={`border-t pt-3 text-[11px] leading-relaxed ${
        isDark
          ? "border-white/10 text-white/50"
          : "border-[var(--brand-border)] text-slate-500"
      } ${className}`}
    >
      <p className={`font-medium ${isDark ? "text-[var(--brand-gold-light)]" : "text-[var(--brand-gold)]"}`}>
        {APP_BRANDING.developerNameEn}
      </p>
      {!compact && (
        <p className={`mt-0.5 ${isDark ? "text-white/45" : "text-slate-400"}`}>
          {APP_BRANDING.developerTaglineAr}
        </p>
      )}
      <p className="mt-1.5">
        <span className={isDark ? "text-white/40" : "text-slate-400"}>الإصدار </span>
        <span className={`font-mono ${isDark ? "text-white/70" : "text-slate-600"}`}>
          v{APP_BRANDING.version}
        </span>
        <span className={`mx-1 ${isDark ? "text-white/25" : "text-slate-300"}`}>·</span>
        <span className={isDark ? "text-white/40" : "text-slate-400"}>© {year}</span>
      </p>
      {!compact && (
        <Link
          href="/settings/about"
          className={`mt-1.5 inline-block hover:underline ${
            isDark ? "text-[var(--brand-green)]" : "text-[var(--brand-green)]"
          }`}
        >
          عن البرنامج
        </Link>
      )}
    </footer>
  );
}
