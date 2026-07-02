"use client";

import Link from "next/link";
import type { PermissionKey } from "@/modules/settings/permissions/permission-catalog";
import { useAuth } from "@/modules/auth/auth-context";
import { SettingsNav } from "@/modules/settings/components/settings-nav";

const LINKS: Array<{
  href: string;
  title: string;
  description: string;
  permission: PermissionKey;
}> = [
  {
    href: "/settings/company",
    title: "بيانات الشركة",
    description: "الاسم القانوني، الرقم الضريبي، العنوان، السنة المالية.",
    permission: "settings.company.view",
  },
  {
    href: "/settings/users",
    title: "المستخدمون",
    description: "إدارة حسابات الدخول والتفعيل.",
    permission: "settings.users.view",
  },
  {
    href: "/settings/permissions",
    title: "الصلاحيات التفصيلية",
    description: "منح صلاحيات دقيقة لكل مستخدم — عرض، إنشاء، تعديل، ترحيل.",
    permission: "settings.permissions.manage",
  },
  {
    href: "/settings/about",
    title: "عن البرنامج",
    description: "الإصدار، المطوّر، ومعلومات Rosemary Software Solutions.",
    permission: "settings.company.view",
  },
  {
    href: "/vouchers/settings",
    title: "إعدادات السندات",
    description: "الترقيم التلقائي، الحسابات الافتراضية، مراكز الكلفة.",
    permission: "vouchers.settings",
  },
  {
    href: "/customers",
    title: "إعدادات العملاء",
    description: "حساب أب الذمم المدينة الافتراضي — من صفحة العملاء.",
    permission: "customers.view",
  },
  {
    href: "/vendors",
    title: "إعدادات الموردين",
    description: "حساب أب الذمم الدائنة الافتراضي — من صفحة الموردين.",
    permission: "vendors.view",
  },
];

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const visibleLinks = LINKS.filter((link) => hasPermission(link.permission));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">الإعدادات</h1>
        <p className="mt-1 text-sm text-slate-600">
          إعدادات عامة للبرنامج وإدارة المستخدمين.
        </p>
      </div>

      <SettingsNav />

      <section className="grid gap-3">
        {visibleLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/30"
          >
            <h2 className="font-semibold text-slate-900">{link.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{link.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
