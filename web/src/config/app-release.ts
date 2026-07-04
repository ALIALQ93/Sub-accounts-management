export type ReleasePhase = "trial" | "stable";

export interface ReleaseNoteItem {
  title: string;
  details?: string;
}

export const APP_RELEASE = {
  /** رقم الإصدار الدلالي — يُحدَّث مع كل إصدار للمستخدمين */
  version: "0.1.0",
  /** معرّف البناء الداخلي — يتغيّر مع كل نشر تجريبي */
  build: "trial-1",
  /** تاريخ الإصدار (YYYY-MM-DD) */
  releasedAt: "2026-07-04",
  phase: "trial" as ReleasePhase,
  labelAr: "تجربة أولى",

  headlineAr: "مرحباً بكم في التجربة الأولى",
  summaryAr:
    "هذا الإصدار مخصّص للاختبار التشغيلي. يُرجى التحقق من إعداد قاعدة البيانات قبل البدء، وإبلاغنا بأي ملاحظات.",

  highlights: [
    {
      title: "سندات قبض وصرف وتصفية",
      details: "عملة السند، سعر صرف محفوظ، اعتماد وترحيل من القائمة أو النموذج",
    },
    {
      title: "كشف حساب متعدد العملات",
      details: "قيم أصلية منفصلة، سعر السند المخزن، حسابات متعددة",
    },
    {
      title: "دليل حسابات وعملاء وموردون",
      details: "مزامنة الحسابات أثناء إدخال السندات",
    },
    {
      title: "صلاحيات ومستخدمون",
      details: "أول مستخدم يصبح مديراً تلقائياً",
    },
  ] satisfies ReleaseNoteItem[],

  trialWarnings: [
    "شغّل database/setup_all.sql على بيئة تجريبية فقط — يحذف كل البيانات.",
    "لا تُعاد تشغيل ترقيعات SQL قديمة بعد التثبيت الحالي (قد تُرجع دوال الترحيل لنسخة أقدم).",
    "ميزان المراجعة يعتمد debit/credit وليس debit_base — راجع التوثيق عند العمل بعملات متعددة.",
  ],

  database: {
    freshInstall: "database/setup_all.sql",
    optionalTests: "database/03_test_cases.sql",
    upgradeOrder: [
      "database/04_auth.sql",
      "database/05_permissions.sql",
      "database/06_storage.sql",
      "database/patch_journal_line_currency.sql",
    ],
    verifyNote:
      "بعد التثبيت تأكد من وجود debit_base و currency_id على journal_entry_lines و amount_base على voucher_lines.",
  },
} as const;

const DISMISS_STORAGE_PREFIX = "app-release-dismissed:";

export function getReleaseId(): string {
  return `${APP_RELEASE.version}+${APP_RELEASE.build}`;
}

export function getDismissStorageKey(): string {
  return `${DISMISS_STORAGE_PREFIX}${getReleaseId()}`;
}

export function formatDisplayVersion(): string {
  const base = `v${APP_RELEASE.version}`;
  if (APP_RELEASE.phase === "trial") {
    return `${base} · ${APP_RELEASE.labelAr}`;
  }
  return base;
}

export function shouldShowReleaseBanner(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(getDismissStorageKey()) !== "1";
}

export function dismissReleaseBanner(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getDismissStorageKey(), "1");
}
