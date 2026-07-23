"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { InventoryShortageAlert } from "@/modules/materials/components/inventory-shortage-alert";
import { StuckTransfersAlert } from "@/modules/invoices/components/stuck-transfers-alert";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { DashboardStats } from "@/modules/vouchers/types";

function formatAmount(value: number): string {
  return value.toLocaleString("ar-IQ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type StatTone = "navy" | "gold" | "green" | "slate";

const TONE_STYLES: Record<StatTone, { chip: string; value: string; accent: string }> = {
  navy: {
    chip: "bg-[var(--brand-navy)]/10 text-[var(--brand-navy)]",
    value: "text-[var(--brand-navy)]",
    accent: "from-[var(--brand-navy)] to-[var(--brand-navy-light)]",
  },
  gold: {
    chip: "bg-[var(--brand-gold)]/15 text-[#8a6d10]",
    value: "text-[#8a6d10]",
    accent: "from-[var(--brand-gold)] to-[var(--brand-gold-light)]",
  },
  green: {
    chip: "bg-[var(--brand-green)]/12 text-[var(--brand-green)]",
    value: "text-[var(--brand-green)]",
    accent: "from-[var(--brand-green)] to-[#57b96c]",
  },
  slate: {
    chip: "bg-slate-100 text-slate-600",
    value: "text-slate-900",
    accent: "from-slate-400 to-slate-500",
  },
};

function StatCard({
  label,
  value,
  tone,
  icon,
  isNumeric,
}: {
  label: string;
  value: ReactNode;
  tone: StatTone;
  icon: ReactNode;
  isNumeric?: boolean;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <article className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-l ${styles.accent}`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p
            className={`mt-2 text-2xl font-bold ${styles.value} ${
              isNumeric ? "font-mono tabular-nums" : ""
            }`}
          >
            {value}
          </p>
        </div>
        <span
          aria-hidden
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${styles.chip} transition group-hover:scale-105`}
        >
          {icon}
        </span>
      </div>
    </article>
  );
}

const ICONS: Record<string, ReactNode> = {
  documents: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M9 9h1M9 13h6M9 17h6" />
    </svg>
  ),
  calendar: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  debit: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  ),
  credit: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  ),
};

function movementHref(stats: DashboardStats): string {
  if (!stats.last_movement) return "#";
  return stats.last_movement.type === "voucher"
    ? `/vouchers/${stats.last_movement.id}`
    : `/journals/${stats.last_movement.id}`;
}

export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        const data = await voucherApi.getDashboardStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "فشل تحميل لوحة التحكم.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
          لوحة التحكم
        </h1>
        <p className="mt-1 text-slate-600">
          ملخص سريع للسندات والقيود والحركات الأخيرة.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/8 px-4 py-3 text-sm text-[var(--danger)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <InventoryShortageAlert />
      <StuckTransfersAlert />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="عدد السندات"
          tone="navy"
          icon={ICONS.documents}
          value={isLoading ? "…" : (stats?.voucher_count ?? 0)}
        />
        <StatCard
          label="قيود اليوم"
          tone="green"
          icon={ICONS.calendar}
          value={isLoading ? "…" : (stats?.today_journal_count ?? 0)}
        />
        <StatCard
          label="إجمالي المدين"
          tone="slate"
          icon={ICONS.debit}
          isNumeric
          value={isLoading ? "…" : formatAmount(stats?.total_debit ?? 0)}
        />
        <StatCard
          label="إجمالي الدائن"
          tone="gold"
          icon={ICONS.credit}
          isNumeric
          value={isLoading ? "…" : formatAmount(stats?.total_credit ?? 0)}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">آخر حركة</h2>
        {isLoading ? (
          <p className="mt-2 text-sm text-slate-500">جاري التحميل...</p>
        ) : stats?.last_movement ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">
                {stats.last_movement.type === "voucher" ? "سند" : "قيد"}:{" "}
                {stats.last_movement.reference}
              </p>
              <p className="text-sm text-slate-600">
                التاريخ: {stats.last_movement.date} — الحالة:{" "}
                {stats.last_movement.status}
              </p>
              {stats.last_movement.description && (
                <p className="text-sm text-slate-500">
                  {stats.last_movement.description}
                </p>
              )}
            </div>
            <Link
              href={movementHref(stats)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-[var(--brand-navy)] transition hover:border-[var(--brand-navy)] hover:bg-[var(--brand-navy)] hover:text-white"
            >
              عرض التفاصيل
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">لا توجد حركات بعد.</p>
        )}
      </section>

      <p className="text-sm text-slate-500">
        اختصارات الوصول السريع متوفرة في الشريط العلوي — يمكنك تعديلها وإضافتها
        من زر «تعديل».
      </p>
    </main>
  );
}
