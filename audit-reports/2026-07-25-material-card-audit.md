# تدقيق دقيق — وحدة صغيرة: بطاقة المادة (قائمة/إنشاء/تعديل)

> **حالة المعالجة (2026-07-25):** §1 أزرار/ألوان ✓ · §2 حذف `MaterialsNav` ✓ · §3 عمود النوع ✓ · §4 ترويسة التعديل ✓ · §5 التحقق كان سليماً.

منهجية: قراءة مباشرة لـ`web/src/app/materials/{page,new,[id]}.tsx` و`web/src/modules/materials/components/{material-form,material-overview-panel,material-search-field}.tsx`، مقارنةً بنظام التصميم المشترك.

---

## 1. زر الحفظ خارج نظام التصميم — ✓ مُغلق

~~`bg-blue-900` / `text-rose-700` يدوي.~~

**الإصلاح:** `btn btn-primary` / `btn btn-outline` / `text-[var(--danger)]` + تبويبات بـ`--brand-navy`.

## 2. `MaterialsNav` ميت — ✓ مُغلق

~~استيراد `return null` بكل الصفحات.~~

**الإصلاح:** حُذف الملف وكل الاستيرادات من صفحات المواد.

## 3. قائمة المواد لا تُميّز التجميعية — ✓ مُغلق

**الإصلاح:** عمود «النوع» (عادية / تجميعية) في `materials/page.tsx`.

## 4. تفاوت ترويسة صفحة التعديل — ✓ مُغلق

**الإصلاح:** ترويسة موحّدة `mb-4` مع كود/اسم المادة ضمن العنوان.

## 5. ملاحظة إيجابية

منطق `validate()` بـ`material-form` شامل وصحيح. لا إجراء مطلوب.

---

## توصيات مرتّبة حسب الأولوية

### ✓ مُغلق
1. ~~توحيد الأزرار/الأخطاء (§1)~~.
2. ~~حذف `MaterialsNav` (§2)~~.
3. ~~ترويسة التعديل (§4)~~.
4. ~~عمود تجميعية/عادية (§3)~~.

## ملحق
- `web/src/app/materials/{page,new,[id]}.tsx`
- `web/src/modules/materials/components/{material-form,material-overview-panel}.tsx`
