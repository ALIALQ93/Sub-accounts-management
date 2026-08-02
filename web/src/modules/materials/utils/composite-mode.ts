import type { CompositeMode, MaterialKind } from "@/modules/materials/types";

/** مرحلة الحياة في واجهة بطاقة المادة */
export type MaterialLifecycleUi = "simple" | "kit" | "semi" | "finished";

export const COMPOSITE_MODES: readonly CompositeMode[] = [
  "kit",
  "semi",
  "semi_disassemblable",
  "finished",
  "disassemblable",
] as const;

export function parseCompositeMode(
  mode: string | null | undefined,
  materialKind?: MaterialKind | string | null,
): CompositeMode | null {
  if (
    mode === "kit" ||
    mode === "semi" ||
    mode === "semi_disassemblable" ||
    mode === "finished" ||
    mode === "disassemblable"
  ) {
    return mode;
  }
  if (materialKind === "composite") return "kit";
  return null;
}

export function uiFromMaterial(
  kind: MaterialKind | string | null | undefined,
  mode: CompositeMode | null | undefined,
): { lifecycle: MaterialLifecycleUi; disassemblable: boolean } {
  if (kind !== "composite") {
    return { lifecycle: "simple", disassemblable: false };
  }
  const m = parseCompositeMode(mode, "composite") ?? "kit";
  if (m === "kit") return { lifecycle: "kit", disassemblable: false };
  if (m === "semi") return { lifecycle: "semi", disassemblable: false };
  if (m === "semi_disassemblable") return { lifecycle: "semi", disassemblable: true };
  if (m === "finished") return { lifecycle: "finished", disassemblable: false };
  return { lifecycle: "finished", disassemblable: true };
}

export function materialFromUi(
  lifecycle: MaterialLifecycleUi,
  disassemblable: boolean,
): { material_kind: MaterialKind; composite_mode: CompositeMode | null } {
  if (lifecycle === "simple") {
    return { material_kind: "normal", composite_mode: null };
  }
  if (lifecycle === "kit") {
    return { material_kind: "composite", composite_mode: "kit" };
  }
  if (lifecycle === "semi") {
    return {
      material_kind: "composite",
      composite_mode: disassemblable ? "semi_disassemblable" : "semi",
    };
  }
  return {
    material_kind: "composite",
    composite_mode: disassemblable ? "disassemblable" : "finished",
  };
}

/** يُسمح به كسطر إنتاج في فاتورة تصنيع */
export function canManufactureProduce(
  mode: CompositeMode | null | undefined,
): boolean {
  const m = mode ?? "kit";
  return (
    m === "semi" ||
    m === "semi_disassemblable" ||
    m === "finished" ||
    m === "disassemblable"
  );
}

/** يُسمح به كسطر استهلاك في فاتورة تفكيك */
export function canDisassembleConsume(
  mode: CompositeMode | null | undefined,
): boolean {
  const m = mode ?? "kit";
  return m === "disassemblable" || m === "semi_disassemblable";
}

/** طقم يُفك تلقائياً عند الإخراج */
export function explodesOnOutbound(
  mode: CompositeMode | null | undefined,
): boolean {
  return (mode ?? "kit") === "kit";
}

export function compositeModeHint(
  mode: CompositeMode | null | undefined,
): string {
  switch (mode) {
    case "semi":
      return "نصف مصنّع: يُخزَّن بعد التصنيع ويُستهلك لاحقاً — بلا فاتورة تفكيك.";
    case "semi_disassemblable":
      return "نصف مصنّع قابل للتفكيك: يُخزَّن، ويمكن تفكيكه لاحقاً مع تسجيل التالف.";
    case "finished":
      return "منتج نهائي: يُخزَّن بعد التصنيع ويُباع كوحدة بلا تفكيك.";
    case "disassemblable":
      return "منتج نهائي قابل للتفكيك: يُخزَّن ويُباع كوحدة، مع إمكانية فاتورة تفكيك.";
    case "kit":
      return "طقم: عند البيع/الإخراج يُستهلك مخزون المكوّنات وفق BOM — لا رصيد للأب.";
    default:
      return "مادة بسيطة: تُشترى وتُخزَّن وتُستهلك — بلا تصنيع إنتاج.";
  }
}

/** تسمية قصيرة للعرض في القوائم */
export function compositeModeLabel(
  kind: MaterialKind | string | null | undefined,
  mode: CompositeMode | null | undefined,
): string {
  if (kind !== "composite") return "بسيطة";
  switch (parseCompositeMode(mode, "composite")) {
    case "kit":
      return "طقم";
    case "semi":
      return "نصف مصنّع";
    case "semi_disassemblable":
      return "نصف مصنّع · قابل للتفكيك";
    case "finished":
      return "منتج نهائي";
    case "disassemblable":
      return "منتج نهائي · قابل للتفكيك";
    default:
      return "تجميعية";
  }
}
