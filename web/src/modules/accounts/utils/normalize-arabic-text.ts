/**
 * توحيد النص العربي للمقارنة (تكرار الأسماء، البحث) — لا يُستخدم للعرض.
 */
export function normalizeArabicForComparison(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLocaleLowerCase("ar");
}
