import Image from "next/image";
import { APP_BRANDING } from "@/config/app-branding";

interface AppBrandLogoProps {
  variant?: "full" | "icon";
  className?: string;
  priority?: boolean;
}

export function AppBrandLogo({
  variant = "icon",
  className = "",
  priority = false,
}: AppBrandLogoProps) {
  if (variant === "full") {
    return (
      <Image
        src={APP_BRANDING.logos.full}
        alt={APP_BRANDING.developerNameEn}
        width={280}
        height={120}
        priority={priority}
        className={`h-auto w-full max-w-[220px] object-contain ${className}`}
      />
    );
  }

  return (
    <Image
      src={APP_BRANDING.logos.icon}
      alt={APP_BRANDING.developerNameEn}
      width={48}
      height={48}
      priority={priority}
      className={`h-10 w-10 shrink-0 object-contain ${className}`}
    />
  );
}
