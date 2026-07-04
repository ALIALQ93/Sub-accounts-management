import type { PostgrestError } from "@supabase/supabase-js";

export function formatSupabaseErrorMessage(error: PostgrestError): string {
  const parts = [error.message, error.details, error.hint].filter(
    (part): part is string => Boolean(part && part.trim()),
  );

  const combined = parts.join(" — ").trim();
  if (!combined) return "حدث خطأ غير متوقع من قاعدة البيانات.";

  if (error.code === "PGRST116") {
    return "السند غير موجود أو لم يُعثر على سجل مطابق.";
  }

  if (/Could not find the '.*' column/i.test(combined)) {
    return `${combined} — قد تحتاج لتشغيل ملفات الترقية (patch) على قاعدة Supabase.`;
  }

  return combined;
}
