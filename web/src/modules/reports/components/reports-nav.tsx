import Link from "next/link";

interface ReportsNavProps {
  active?: "hub" | "trial-balance";
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
    </nav>
  );
}
