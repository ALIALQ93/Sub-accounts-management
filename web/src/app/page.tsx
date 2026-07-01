import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold text-slate-900">Sub Accounts Management</h1>
        <p className="text-slate-600">
          البداية السريعة: إدارة السندات، الحسابات، وشاشات التشغيل اليومية.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/vouchers"
            className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white"
          >
            قائمة السندات
          </Link>
          <Link
            href="/vouchers/new"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            سند جديد
          </Link>
          <Link
            href="/accounts"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            دليل الحسابات
          </Link>
          <Link
            href="/customers"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            العملاء
          </Link>
          <Link
            href="/vendors"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            الموردين
          </Link>
          <Link
            href="/open-movements"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            الحركات المفتوحة
          </Link>
          <Link
            href="/journals"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            قيود اليومية
          </Link>
          <Link
            href="/reports/trial-balance"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            ميزان المراجعة
          </Link>
        </div>
      </main>
    </div>
  );
}
