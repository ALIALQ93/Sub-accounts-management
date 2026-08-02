import type { ManufacturingProduceExpiryPolicy } from "@/modules/materials/types";

export type ProduceExpiryLine = {
  clientId: string;
  manufacturing_role?: "consume" | "produce" | null;
  expiry_date?: string | null;
  /** عند true لا تُستبدل صلاحية الإنتاج بالاقتراح التلقائي */
  expiry_manual?: boolean;
  material_id: string;
};

export type ProduceExpiryMaterial = {
  id: string;
  has_expiry_date?: boolean;
  expiry_days?: number | null;
};

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function minIsoDate(dates: string[]): string | null {
  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (a < b ? a : b));
}

/** يقترح تاريخ صلاحية لسطر إنتاج حسب سياسة الشركة */
export function suggestProduceExpiryDate(args: {
  policy: ManufacturingProduceExpiryPolicy;
  invoiceDate: string;
  consumeExpiryDates: Array<string | null | undefined>;
  produceExpiryDays: number | null | undefined;
}): string | null {
  const { policy, invoiceDate, consumeExpiryDates, produceExpiryDays } = args;
  if (policy === "manual") return null;

  const componentDates = consumeExpiryDates.filter(
    (d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d),
  );
  const minComponent = minIsoDate(componentDates);

  const fromDays =
    produceExpiryDays != null && produceExpiryDays > 0 && invoiceDate
      ? addDaysIso(invoiceDate, produceExpiryDays)
      : null;

  if (policy === "min_component") return minComponent;
  if (policy === "production_plus_days") return fromDays;
  // min_of_both
  if (minComponent && fromDays) return minIsoDate([minComponent, fromDays]);
  return minComponent ?? fromDays;
}

/**
 * يحدّث أسطر الإنتاج غير المعدّلة يدوياً باقتراح الصلاحية.
 * يُرجع نفس المصفوفة إن لم يتغيّر شيء.
 */
export function applyProduceExpirySuggestions<T extends ProduceExpiryLine>(
  lines: T[],
  materialsById: Map<string, ProduceExpiryMaterial>,
  policy: ManufacturingProduceExpiryPolicy,
  invoiceDate: string,
): T[] {
  if (policy === "manual") return lines;

  const consumeDates = lines
    .filter((l) => l.manufacturing_role === "consume")
    .map((l) => l.expiry_date);

  let changed = false;
  const next = lines.map((line) => {
    if (line.manufacturing_role !== "produce" || line.expiry_manual) {
      return line;
    }
    const material = materialsById.get(line.material_id);
    if (!material?.has_expiry_date) return line;

    const suggested = suggestProduceExpiryDate({
      policy,
      invoiceDate,
      consumeExpiryDates: consumeDates,
      produceExpiryDays: material.expiry_days,
    });
    if (!suggested || suggested === line.expiry_date) return line;
    changed = true;
    return { ...line, expiry_date: suggested };
  });

  return changed ? next : lines;
}
