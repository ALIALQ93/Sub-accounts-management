# النواقص المتبقية — بعد التحقق من تنفيذ AUDIT_FINDINGS.md و AUDIT_FINDINGS_PENDING.md

تم التحقق (2026-07-07) من كل بنود الملفين السابقين مقابل الكود الحالي.

**آخر تحديث:** 2026-07-07 — نُفّذت البنود المتبقية من القسم 2.

---

## 1) حرج — خطأ طباعي ميزان المراجعة ✅ مُصلَح

`jel.debit_base_base` → `jel.debit_base` في:
- `database/patch_trial_balance_opening.sql`
- `database/01_schema.sql`

أعد توليد `setup_all.sql` عبر `database/build_setup_all.ps1`.

**التحقق:** `select * from public.get_trial_balance();` — بدون خطأ عمود.

---

## 2) منخفض — الحالة بعد التنفيذ

| البند | الحالة |
|-------|--------|
| تأكيد تعطيل الحساب (`toggleActive`) | ✅ `window.confirm` في `accounts/page.tsx` |
| توليد كود الحساب + تزامن | ✅ `createAccountWithGeneratedCode` — إعادة محاولة عند تصادم `code` |
| استيراد جماعي ذرّي | ✅ `bulk_create_accounts` RPC (#28) |
| توحيد الاسم العربي (ألف/تشكيل) | ✅ `normalizeArabicForComparison` في الاستيراد الجماعي + إنشاء حساب مفرد |
| قفل فرع المستودع بعد حركات | ✅ `patch_audit_remaining.sql` (#30) + تحقق في `warehouse-api.ts` |
| دوران تصنيفات المواد | ✅ `material_categories_apply_hierarchy_rules` (#30) |
| `listLegacyFallback` | ✅ حُذف — رسالة خطأ واضحة إن لم يتوفر `open_items_view` |

---

## 3) خارج نطاق هذا التدقيق حتى الآن

ميزات لم تُدقَّق بعد (جولة منفصلة لاحقاً):

- الفترات المحاسبية، مراحل الجرد 2–7، خصومات/تقريب الفواتير، القيد الافتتاحي، مراجع الفواتير المتعددة.

---

## ترقية قاعدة موجودة (بعد #29)

```text
patch_audit_remaining.sql
```

أو أعد تشغيل `setup_all.sql` على بيئة تطوير.
