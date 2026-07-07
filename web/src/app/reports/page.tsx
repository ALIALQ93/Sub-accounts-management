import Link from "next/link";
import { ReportsNav } from "@/modules/reports/components/reports-nav";
import { InventoryShortageAlert } from "@/modules/materials/components/inventory-shortage-alert";

type ReportStatus = "available" | "soon";

interface ReportCard {
  title: string;
  description: string;
  href?: string;
  status: ReportStatus;
  phase: string;
}

const REPORTS: ReportCard[] = [
  {
    title: "ميزان المراجعة",
    description: "أرصدة الحسابات — مدين، دائن، وصافي الرصيد لفترة محددة.",
    href: "/reports/trial-balance",
    status: "available",
    phase: "جاهز",
  },
  {
    title: "كشف حساب",
    description:
      "حركة حساب واحد مع رصيد افتتاحي وتراكمي — اختيار مباشر للحساب والفترة.",
    href: "/reports/account-statement",
    status: "available",
    phase: "جاهز",
  },
  {
    title: "تقرير السندات",
    description: "تجميع حسب نوع السند، العملة، التاريخ، وحالة الترحيل.",
    status: "soon",
    phase: "المرحلة 2",
  },
  {
    title: "تقرير مراكز الكلفة",
    description: "مدين ودائن لكل مركز كلفة — للتحقق من التوازن والتكلفة.",
    status: "soon",
    phase: "المرحلة 2",
  },
  {
    title: "تقرير تصنيفات الأسطر",
    description: "اطعام، تغذية، انشائية… حسب PAY/RCP وكميات التصنيف.",
    status: "soon",
    phase: "المرحلة 2",
  },
  {
    title: "تقرير المشتريات التفصيلي",
    description: "أسطر فواتير مشتريات ومرتجع وبضاعة أول المدة — مرحّلة.",
    href: "/reports/purchase-lines",
    status: "available",
    phase: "جاهز",
  },
  {
    title: "ملخص حركات المخزون",
    description:
      "تجميع per نوع حركة ونوع فاتورة — مشتريات، مبيعات، مناقلة، تسوية.",
    href: "/reports/inventory-movements",
    status: "available",
    phase: "جاهز",
  },
  {
    title: "تكلفة المبيعات (COGS)",
    description:
      "تكلفة وإيراد المبيعات من حركات الفواتير المرحّلة — sale و return_sale.",
    href: "/reports/cogs",
    status: "available",
    phase: "جاهز",
  },
  {
    title: "رصيد المخزون",
    description:
      "كميات وقيم per مادة/مستودع + دفتر حركة — من inventory_movements.",
    href: "/reports/inventory-balance",
    status: "available",
    phase: "جاهز",
  },
  {
    title: "أعمار الذمم",
    description:
      "حركات مفتوحة حسب تاريخ الاستحقاق — عملاء وموردون، مرتبط بفواتير آجل.",
    href: "/reports/receivables-aging",
    status: "available",
    phase: "جاهز",
  },
  {
    title: "ذمم العملاء والموردين",
    description: "قائمة خام للحركات المفتوحة — بدون تصنيف أعمار.",
    href: "/open-movements",
    status: "available",
    phase: "جاهز",
  },
  {
    title: "مقارنة فترتين",
    description: "عرض تقريرين جنباً إلى جنب (ميزان مراجعة Q1 vs Q2).",
    status: "soon",
    phase: "المرحلة 3",
  },
  {
    title: "طباعة / PDF",
    description: "طباعة التقارير أو حفظها PDF من المتصفح — متاح في تقارير المخزون.",
    status: "available",
    phase: "جاهز",
  },
  {
    title: "تصدير Excel (CSV)",
    description: "تصدير CSV من تقارير المخزون وCOGS وملخص الحركات — يفتح في Excel.",
    status: "available",
    phase: "جاهز",
  },
  {
    title: "تصدير PDF",
    description: "قوالب PDF مخصّصة — قريباً (الطباعة من المتصفح متاحة الآن).",
    status: "soon",
    phase: "المرحلة 3",
  },
];

export default function ReportsHubPage() {
  const available = REPORTS.filter((report) => report.status === "available");
  const upcoming = REPORTS.filter((report) => report.status === "soon");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">التقارير</h1>
        <p className="mt-1 text-sm text-slate-600">
          تقارير محاسبية وتشغيلية. افتح أي تقرير في تبويب جديد لمقارنة فترتين أو
          سندين.
        </p>
      </div>

      <ReportsNav active="hub" />

      <InventoryShortageAlert />

      <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">مقارنة في تبويبين</p>
        <p className="mt-1 opacity-90">
          بجانب أزرار «فتح» ستجد زر ↗ — يفتح السند أو التقرير في تبويب متصفح
          منفصل. مثلاً: افتح ميزان مراجعة يناير في تبويب، ومارس في آخر، ثم
          قارن يدوياً.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">متاح الآن</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {available.map((report) => (
            <ReportCardView key={report.title} report={report} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">قريباً</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {upcoming.map((report) => (
            <ReportCardView key={report.title} report={report} />
          ))}
        </div>
      </section>
    </main>
  );
}

function ReportCardView({ report }: { report: ReportCard }) {
  const body = (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{report.title}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            report.status === "available"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {report.phase}
        </span>
      </div>
      <p className="text-sm text-slate-600">{report.description}</p>
      {report.href && report.status === "available" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={report.href}
            className="rounded-md bg-blue-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            فتح
          </Link>
          <Link
            href={report.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
            title="فتح في تبويب جديد"
          >
            ↗ تبويب جديد
          </Link>
        </div>
      )}
    </>
  );

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {body}
    </article>
  );
}
