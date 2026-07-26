# تدقيق دقيق — وحدة صغيرة: كتالوج الوحدات

> **حالة المعالجة (2026-07-25):** §1 مودال `Modal` ✓ · §2 مواءمة صيغة التحويل JS↔SQL (`round` إلى 6 خانات + مصدر مشترك) ✓ · §3 تحذير تعطيل وحدة أساس مستخدمة ✓.

منهجية: قراءة `web/src/app/materials/units/page.tsx`، `web/src/modules/materials/components/unit-form-modal.tsx`، `web/src/modules/materials/services/unit-api.ts`، `web/src/modules/materials/utils/unit-conversion.ts`، والجدول/التريغر المرتبطين بـ`database/patch_materials_card_v2.sql`.

---

## 1. مودال الوحدة لا يستخدم مكوّن `Modal` المشترك — ✓ مُغلق

~~كان يدوياً بلا Escape/ARIA.~~

**الإصلاح:** `unit-form-modal.tsx` → `Modal` + نظام الأزرار.

## 2. طبقة تحويل مكرَّرة بين الواجهة وقاعدة البيانات — ✓ مُغلق (توثيق + مواءمة)

~~احتمال انحراف بسبب صيغة JS بلا تقريب.~~

**الإصلاح:** `computeFactorToBase` يطابق `round(..., 6)` في `material_units_sync_conversion`؛ `material-api` يستخدم الدالة المشتركة عند الإدراج/التحديث؛ تعليقات متبادلة SQL↔TS. المرجع النهائي عند الحفظ يبقى تريغر SQL.

## 3. لا حماية من حذف/تعطيل وحدة مستخدمة — ✓ مُغلق (تحذير)

~~تعطيل وحدة أساس مستخدمة كان بصمت.~~

**الإصلاح:** `unitApi.countBaseUnitUsages` + `confirm` قبل التعطيل إن وُجدت مواد تعتمدها كأساس. (لا مسار حذف من الواجهة أصلاً.)

---

## توصيات مرتّبة حسب الأولوية

### ✓ مُغلق
1. ~~مودال `Modal` (§1)~~.
2. ~~توحيد/توثيق منطق التحويل (§2)~~.
3. ~~تحذير تعطيل وحدة أساس مستخدمة (§3)~~.

## ملحق
- `web/src/app/materials/units/page.tsx`
- `web/src/modules/materials/components/unit-form-modal.tsx`
- `web/src/modules/materials/utils/unit-conversion.ts`
- `database/patch_materials_card_v2.sql:110-149`
