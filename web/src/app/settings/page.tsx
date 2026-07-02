"use client";

import Link from "next/link";
import { SettingsNav } from "@/modules/settings/components/settings-nav";

const LINKS = [
  {
    href: "/settings/company",
    title: "بيانات الشركة",
    description: "الاسم القانوني، الرقم الضريبي، العنوان، السنة المالية.",
  },
  {
    href: "/settings/users",
    title: "المستخدمون",
    description: "إدارة حسابات الدخول والصلاحيات (مدير / محاسب / عرض).",
    adminOnly: true,
  },
  {
    href: "/vouchers/settings",
    title: "إعدادات السندات",
    description: "الترقيم التلقائي، الحسابات الافتراضية، مراكز الكلفة.",
  },
  {
    href: "/customers",
    title: "إعدادات العملاء",
    description: "حساب أب الذمم المدينة الافتراضي — من صفحة العملاء.",
  },
  {
    href: "/vendors",
    title: "إعدادات الموردين",
    description: "حساب أب الذمم الدائنة الافتراضي — من صفحة الموردين.",
  },
];

export default function SettingsPage() {
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
        {LINKS.map((link) => (
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
