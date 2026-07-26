# تدقيق دقيق — وحدة صغيرة: إعدادات الجرد والتكلفة

> **حالة المعالجة (2026-07-25):** §1 FIFO معطّل بالواجهة (كان سليماً) ✓ · §2 توضيح last_purchase vs نمط الفاتورة ✓ · §3 قفل الحقول (كان سليماً) ✓ · §4 تنبيه قبل أول ترحيل يقفل الإعدادات ✓.

منهجية: قراءة `web/src/app/materials/settings/page.tsx`، `web/src/modules/materials/services/inventory-settings-api.ts`، وجدول `company_inventory_settings`، مقارنةً بمحرك التكلفة الفعلي (`calc_outbound_unit_cost`).

---

## 1. خيار FIFO زخرفي — الواجهة تُقرّ بذلك ✓ (كان سليماً)

لا يمكن اختيار `fifo`/`last_purchase` من القائمة؛ قيم قديمة تظهر بتحذير أصفر. لا إجراء مطلوب.

## 2. التباس «آخر شراء» الشركة vs `pricing_consumed_mode=standard` — ✓ مُغلق

~~تعليق/نص غير واضح.~~

**الإصلاح:** تعليقات أوضح بالكود + نص توضيحي بشاشة الإعدادات + ملاحظة بنموذج نمط الفاتورة أن «معياري / سعر شراء البطاقة» مستقل عن إعداد الشركة «آخر شراء».

## 3. تعطيل الحقول عند `foundation_locked` — صحيح ✓

لا إجراء مطلوب.

## 4. لا تحذير قبل أول ترحيل يقفل الإعدادات — ✓ مُغلق

~~القفل كان يحدث بصمت.~~

**الإصلاح:** `confirm-foundation-lock.ts` يُستدعى من `postInvoice` و`postAdjustment` و`postBatchAdjustment` قبل أول ترحيل مخزني؛ نص الشاشة يذكر التنبيه أيضاً.

---

## توصيات مرتّبة حسب الأولوية

### ✓ مُغلق
1. ~~توضيح الفرق last_purchase vs standard (§2)~~.
2. ~~تنبيه عند أول ترحيل مخزني (§4)~~.

## ملحق
- `web/src/app/materials/settings/page.tsx`
- `web/src/modules/materials/utils/confirm-foundation-lock.ts`
- `web/src/modules/invoices/services/invoice-api.ts`
- `web/src/modules/materials/services/stock-adjustment-api.ts`
