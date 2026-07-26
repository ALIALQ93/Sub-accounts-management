# تدقيق دقيق — وحدة صغيرة: تسوية الجرد (مفردة/مجمّعة)

> **حالة المعالجة (2026-07-25):** §1 «per» ✓ · §2 كان سليماً · §3 إشارة فرق صفري ✓ · §4 تحذير حساب المخزون ✓ · §5 قفل التزامن كان سليماً.

منهجية: قراءة `web/src/app/materials/stock-adjustment/{new,batch}/page.tsx` و`web/src/modules/materials/services/stock-adjustment-api.ts`.

---

## 1. خطأ نصي «per» — ✓ مُغلق

**الإصلاح:** «سطور القيد لكل فرع».

## 2. التسوية المفردة تمنع الفرق الصفري — سلوك صحيح ✓

لا إجراء مطلوب.

## 3. استبعاد الفرق الصفري بصمت بالمجمّعة — ✓ مُغلق

**الإصلاح:** تمييز صف أصفر + نص «لن يُرحَّل (فرق صفري)».

## 4. حساب مخزون مختلف عن البطاقة بلا تحذير — ✓ مُغلق

**الإصلاح:** تنبيه كهرماني عند اختلاف `inventoryAccountId` عن `selectedMaterial.inventory_account_id`.

## 5. قفل التزامن — صحيح ✓

`inventory_movements_enforce_stock` يستخدم `pg_advisory_xact_lock`. لا إجراء مطلوب.

---

## توصيات مرتّبة حسب الأولوية

### ✓ مُغلق
1. ~~تحذير حساب المخزون (§4)~~.
2. ~~تصحيح «per» (§1)~~.
3. ~~إشارة الفرق الصفري (§3)~~.

## ملحق
- `web/src/app/materials/stock-adjustment/{new,batch}/page.tsx`
- `web/src/modules/materials/services/stock-adjustment-api.ts`
