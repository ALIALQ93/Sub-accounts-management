import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { NotificationProvider } from "@/components/notifications";
import { APP_BRANDING } from "@/config/app-branding";
import { AuthProvider } from "@/modules/auth/auth-context";
import "./globals.css";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ibm-plex-arabic",
  weight: ["400", "500", "600", "700"],
  subsets: ["arabic", "latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_BRANDING.productNameAr,
  description: APP_BRANDING.developerTaglineAr,
  icons: {
    icon: APP_BRANDING.logos.icon,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${ibmPlexSansArabic.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden">
        <AuthProvider>
          <NotificationProvider>
            <AppShell>{children}</AppShell>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
