# تدقيق دقيق — وحدة صغيرة: المستودعات

> **حالة المعالجة (2026-07-25):** §1 مودال `Modal` ✓ · §2 تريغر فرع المستودع كان موجوداً مسبقاً (`patch_audit_remaining`) ✓ · §3 تحذير رصيد عند التعطيل ✓.

منهجية: قراءة `web/src/app/materials/warehouses/page.tsx`، `web/src/modules/materials/components/warehouse-form-modal.tsx`، `web/src/modules/materials/services/warehouse-api.ts`، والتريغر المرتبط بـ`database/patch_audit_remaining.sql`.

---

## 1. مودال المستودع لا يستخدم مكوّن `Modal` المشترك — ✓ مُغلق

~~كان `fixed inset-0` يدوياً.~~

**الإصلاح:** `warehouse-form-modal.tsx` يستخدم `Modal` + أزرار نظام التصميم.

## 2. منع تغيير فرع المستودع محمي بالواجهة فقط — ✓ مُغلق (تصحيح للتقرير)

~~التقرير افترض غياب تريغر DB.~~

**الواقع:** التريغر `warehouses_prevent_branch_change_with_movements` موجود في `patch_audit_remaining.sql` ومُدمَج بـ`setup_all.sql` منذ #30. فحص الواجهة في `warehouse-api.ts` يبقى طبقة إضافية للرسالة العربية — الإنفاذ الخلفي قائم.

## 3. لا صلة بين تعطيل المستودع وحدوده/أرصدته — ✓ مُغلق (تحذير)

~~كان التعطيل بصمت دون فحص رصيد.~~

**الإصلاح:** قبل التعطيل تستدعي الواجهة `warehouseApi.hasPositiveStock` وتعرض `confirm` إن وُجد رصيد قائم.

---

## توصيات مرتّبة حسب الأولوية

### ✓ مُغلق
1. ~~تريغر DB لمنع تغيير الفرع (§2)~~ — كان موجوداً؛ أُكِّد.
2. ~~مودال `Modal` المشترك (§1)~~.
3. ~~تحذير عند تعطيل مستودع برصيد (§3)~~.

## ملحق
- `web/src/app/materials/warehouses/page.tsx`
- `web/src/modules/materials/components/warehouse-form-modal.tsx`
- `web/src/modules/materials/services/warehouse-api.ts`
- `database/patch_audit_remaining.sql:55-80`
