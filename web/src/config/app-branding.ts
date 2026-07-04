import { APP_RELEASE } from "@/config/app-release";

export const APP_BRANDING = {
  /** اسم المنتج الافتراضي (يُستبدل باسم الشركة من الإعدادات عند التحميل) */
  productNameAr: "نظام إدارة الحسابات الفرعية",
  productTaglineAr: "محاسبة · سندات · تقارير",

  developerNameEn: "Rosemary Software Solutions",
  developerTaglineEn: "Integrated Business Systems & Smart Software",
  developerTaglineAr: "أنظمة أعمال متكاملة وبرمجيات ذكية",

  version: APP_RELEASE.version,

  logos: {
    full: "/branding/rosemary-logo-full.png",
    icon: "/branding/rosemary-logo-icon.png",
  },

  supportEmail: "",
  supportPhone: "",
  websiteUrl: "",
} as const;
