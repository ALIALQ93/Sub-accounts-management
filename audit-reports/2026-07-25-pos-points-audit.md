# تدقيق دقيق — وحدة صغيرة: نقاط البيع — الإعداد (POS Points)

> **حالة المعالجة (2026-07-25):** §1 RLS/أعلام (كان مُغلقاً) ✓ · §2 تحقق طريقة دفع نشطة ✓ · §3 توضيح OR للمواد/الأصناف كان موجوداً في `PatternAllowedSection` ✓.

منهجية: قراءة `web/src/app/pos/points/{page,new,[id]}.tsx` مقارنةً بـ`AUDIT_POS.md` والحالة الفعلية لجداول POS بـ`database/setup_all.sql`.

---

## 1. تضييق الصلاحيات والإنفاذ الخلفي — مُغلَق بالفعل ✓

لا فجوة متبقية. RLS + `assert_invoice_may_post` + `hasPermission("pos.settings")`.

## 2. لا تحقق من طريقة دفع نشطة قبل الحفظ — ✓ مُغلق

~~كان يمكن حفظ نقطة بلا دفع نشط.~~

**الإصلاح:** `PosPointForm` يرفض الحفظ إن لم توجد طريقة نشطة بتسمية + حساب.

## 3. التباس قائمتَي المواد/الفئات — ✓ كان موضَّحاً

`PatternAllowedSection` يذكر أصلاً: «تُقبل المواد المختارة أو التابعة للأصناف المختارة» (منطق OR). لا إجراء إضافي مطلوب.

---

## توصيات مرتّبة حسب الأولوية

### ✓ مُغلق
1. ~~تحقق طريقة دفع نشطة (§2)~~.
2. ~~توضيح OR (§3)~~ — نص موجود مسبقاً في المكوّن المشترك.

## ملحق
- `web/src/modules/pos/components/pos-point-form.tsx`
- `web/src/modules/invoices/components/pattern-allowed-section.tsx`
- `database/setup_all.sql` (RLS + `assert_invoice_may_post`)
