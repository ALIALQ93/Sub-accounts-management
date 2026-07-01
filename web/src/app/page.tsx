import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold text-slate-900">Sub Accounts Management</h1>
        <p className="text-slate-600">
          البداية السريعة: افتح شاشة السند الجديدة أو شاشة التعديل.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/vouchers/new"
            className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white"
          >
            سند جديد
          </Link>
          <Link
            href="/vouchers/demo-voucher"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            فتح سند تجريبي
          </Link>
        </div>
      </main>
    </div>
  );
}
