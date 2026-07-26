# تدقيق دقيق — وحدة صغيرة: أصناف المواد

> **حالة المعالجة (2026-07-25):** §1 تعطيل متسلسل ✓ · §2 مودال `Modal` ✓ · §3–4 كانا سليمين · §5 تقارير/تسعير حسب الصنف **مفتوح** (تصميم مستقبلي).

منهجية: قراءة `web/src/app/materials/categories/page.tsx`، `web/src/modules/materials/components/material-category-form-modal.tsx`، `web/src/modules/materials/utils/category-material-tree.ts`، والتريغر الوحيد المرتبط بالجدول (`database/patch_audit_remaining.sql:11`، الفعّال أيضاً بـ`setup_all.sql`). مستخرج ومُعاد تنظيمه من `audit-reports/2026-07-25-materials-ui-categories-audit.md` (§2, §7) بتركيز حصري على وحدة الأصناف، بعد جلسة أسئلة/أجوبة مباشرة مع صاحب المشروع حول الغرض المقصود من الأصناف.

---

## 1. تعطيل صنف أب لا ينعكس على الفروع — ~~فجوة~~ ✓ مُغلق

~~صاحب المشروع أكّد صراحة أن تعطيل صنف أب يجب أن يُعطّل كل ما تحته. الكود الفعلي كان يحدّث صف الصنف فقط.~~

**الإصلاح:** تريغر `material_categories_cascade_deactivate` (`patch_material_category_cascade_deactivate.sql`) يعطّل الأصناف الفرعية والمواد التابعة عند تعطيل الأب؛ الواجهة تعرض `confirm` بعدّ الأبناء/المواد قبل التعطيل.

## 2. مودال الصنف لا يستخدم مكوّن `Modal` المشترك — ~~~~ ✓ مُغلق

~~كان يبني `fixed inset-0` يدوياً.~~

**الإصلاح:** `material-category-form-modal.tsx` يستخدم `Modal` المشترك + `btn btn-primary`/`btn btn-outline`/`text-[var(--danger)]`.

## 3. ترقيم كود المادة حسب الصنف — يعمل بشكل صحيح ✓

[`suggest_next_material_code`](../database/patch_materials_card_v2.sql:320) يبني بادئة من `category_code` + تسلسل رقمي، مع معالجة تصادم ومسار احتياطي. مطابق تماماً لما أكّده صاحب المشروع كسلوك مطلوب. لا إجراء مطلوب.

## 4. لا حسابات محاسبية على مستوى الصنف — مطابق للمقصود ✓

`MaterialCategory` بلا أي حقل حساب محاسبي، كما أكّد صاحب المشروع (الصنف تصنيف تنظيمي بحت). لا إجراء مطلوب.

## 5. استخدامات الصنف بالتقارير/POS/التسعير — حالة متفاوتة (مفتوح جزئياً)

| الاستخدام | الحالة |
|---|---|
| تلخيص التقارير حسب الصنف | ⚠️ جزئي — تقرير رصيد المخزون فقط (`inventory-report-api.ts`)، غائب عن سطور المبيعات/المشتريات/COGS. |
| فلترة POS حسب الصنف | ✓ **مُنفَّذ فعلياً خلفياً** — `assert_invoice_may_post()` |
| تسعير/خصم حسب الصنف | ❌ غير موجود إطلاقاً — لا جدول ولا منطق. |

---

## توصيات مرتّبة حسب الأولوية

### ✓ مُغلق
1. ~~معالجة فجوة تعطيل الأب (§1)~~ — تريغر + تأكيد واجهة.
2. ~~تحويل مودال الصنف لاستخدام `Modal` المشترك (§2)~~.

### 🔵 تصميم مستقبلي (مفتوح)
3. تجميع تقارير المبيعات/المشتريات/COGS حسب الصنف إن كان مطلوباً فعلياً (§5).
4. تسعير/خصم حسب الصنف — يحتاج تصميم من الصفر إن أُريد تبنّيه (§5).

## ملحق
- `web/src/app/materials/categories/page.tsx`
- `web/src/modules/materials/components/material-category-form-modal.tsx`
- `database/patch_material_category_cascade_deactivate.sql`
- `database/patch_audit_remaining.sql:11` (منع الدوران)
- `database/patch_materials_card_v2.sql:320` (ترقيم الكود)
