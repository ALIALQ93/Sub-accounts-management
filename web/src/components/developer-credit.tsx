import Link from "next/link";
import { APP_BRANDING } from "@/config/app-branding";

interface DeveloperCreditProps {
  variant?: "inline" | "footer";
  className?: string;
}

export function DeveloperCredit({
  variant = "footer",
  className = "",
}: DeveloperCreditProps) {
  if (variant === "inline") {
    return (
      <p className={`text-center text-[10px] text-slate-400 ${className}`}>
        Powered by{" "}
        <Link
          href="/settings/about"
          className="text-slate-500 hover:text-[var(--brand-gold)] hover:underline"
        >
          {APP_BRANDING.developerNameEn}
        </Link>
      </p>
    );
  }

  return (
    <div className={`text-center text-[11px] leading-relaxed text-slate-400 ${className}`}>
      <p>
        <span className="text-slate-500">تطوير </span>
        <Link
          href="/settings/about"
          className="font-medium text-slate-500 hover:text-[var(--brand-gold)] hover:underline"
        >
          {APP_BRANDING.developerNameEn}
        </Link>
      </p>
      <p className="mt-0.5 font-mono text-[10px] text-slate-400">
        v{APP_BRANDING.version}
      </p>
    </div>
  );
}
