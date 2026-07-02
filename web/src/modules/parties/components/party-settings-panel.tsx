"use client";

import { useEffect, useState } from "react";
import { AccountSearchField } from "@/modules/vouchers/components/account-search-field";
import { partyApi } from "@/modules/parties/services/party-api";
import type { PartyKind, PartySettings } from "@/modules/parties/types";
import { getPartyParentAccountOptions } from "@/modules/parties/utils/party-parent-accounts";
import type { Account } from "@/modules/vouchers/types";

interface PartySettingsPanelProps {
  kind: PartyKind;
  accounts: Account[];
  settings: PartySettings | null;
  onSettingsChange: (settings: PartySettings) => void;
}

const LABELS: Record<
  PartyKind,
  { title: string; field: string; hint: string; settingsKey: keyof PartySettings }
> = {
  customer: {
    title: "إعدادات العملاء",
    field: "حساب أب الذمم المدينة (افتراضي)",
    hint: "يُستخدم كحساب أب عند إنشاء عميل جديد — يُنشأ حساب فرعي باسم العميل تلقائياً.",
    settingsKey: "customer_parent_account_id",
  },
  vendor: {
    title: "إعدادات الموردين",
    field: "حساب أب الذمم الدائنة (افتراضي)",
    hint: "يُستخدم كحساب أب عند إنشاء مورد جديد — يُنشأ حساب فرعي باسم المورد تلقائياً.",
    settingsKey: "vendor_parent_account_id",
  },
};

export function PartySettingsPanel({
  kind,
  accounts,
  settings,
  onSettingsChange,
}: PartySettingsPanelProps) {
  const labels = LABELS[kind];
  const parentOptions = getPartyParentAccountOptions(accounts);
  const currentValue =
    (settings?.[labels.settingsKey] as string | null | undefined) ?? "";

  const [parentAccountId, setParentAccountId] = useState(currentValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setParentAccountId(currentValue);
  }, [currentValue]);

  const onSave = async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await partyApi.updatePartySettings({
        [labels.settingsKey]: parentAccountId || null,
      });
      onSettingsChange(updated);
      setSuccess("تم حفظ الإعدادات.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حفظ الإعدادات.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <h2 className="text-sm font-semibold text-slate-900">{labels.title}</h2>
      <p className="mt-1 text-xs text-slate-600">{labels.hint}</p>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <AccountSearchField
          label={labels.field}
          accounts={parentOptions}
          value={parentAccountId}
          onChange={(id) => setParentAccountId(id)}
          placeholder="ابحث عن حساب أب (مجمع / غير مرحّل)..."
        />
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={isSaving}
          className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSaving ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </button>
      </div>

      {error && (
        <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}
    </section>
  );
}
