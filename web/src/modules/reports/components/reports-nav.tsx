import Link from "next/link";

interface ReportsNavProps {
  active?:
    | "hub"
    | "trial-balance"
    | "account-statement"
    | "receivables-aging"
    | "inventory-balance"
    | "cogs"
    | "inventory-movements"
    | "purchase-lines"
    | "sales-lines";
}

export function ReportsNav({ active = "hub" }: ReportsNavProps) {
  const itemClass = (isActive: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${
      isActive
        ? "bg-blue-900 text-white"
        : "border border-slate-300 text-slate-700 hover:bg-slate-50"
    }`;

  return (
    <nav className="flex flex-wrap gap-2">
      <Link href="/reports" className={itemClass(active === "hub")}>
        كل التقارير
      </Link>
      <Link
        href="/reports/trial-balance"
        className={itemClass(active === "trial-balance")}
      >
        ميزان المراجعة
      </Link>
      <Link
        href="/reports/account-statement"
        className={itemClass(active === "account-statement")}
      >
        كشف حساب
      </Link>
      <Link
        href="/reports/receivables-aging"
        className={itemClass(active === "receivables-aging")}
      >
        أعمار الذمم
      </Link>
      <Link
        href="/reports/inventory-balance"
        className={itemClass(active === "inventory-balance")}
      >
        رصيد المخزون
      </Link>
      <Link href="/reports/cogs" className={itemClass(active === "cogs")}>
        تكلفة المبيعات
      </Link>
      <Link
        href="/reports/inventory-movements"
        className={itemClass(active === "inventory-movements")}
      >
        ملخص الحركات
      </Link>
      <Link
        href="/reports/purchase-lines"
        className={itemClass(active === "purchase-lines")}
      >
        المشتريات
      </Link>
      <Link
        href="/reports/sales-lines"
        className={itemClass(active === "sales-lines")}
      >
        المبيعات
      </Link>
    </nav>
  );
}
