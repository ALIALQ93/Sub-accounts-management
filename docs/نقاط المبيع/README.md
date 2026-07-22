# نقاط المبيع

واجهة **بيع سريعة** مع تعريف عدة نقاط بيع وتخصيص كل نقطة (فرع، مستودع، نمط فاتورة، طرق دفع، مواد).

## الحالة

| البند | الحالة |
|--------|--------|
| تعريف نقاط البيع | ✅ |
| تخصيص المواد/طرق الدفع | ✅ |
| شاشة البيع + ترحيل فاتورة نقدية | ✅ |
| تقرير صندوق | لاحقاً |
| مزامنة أوفلاين | لاحقاً |

## المسارات

| المسار | الوظيفة | صلاحية |
|--------|---------|--------|
| `/pos` | اختيار نقطة | `pos.view` |
| `/pos/points` | قائمة التعريف | `pos.settings` |
| `/pos/points/new` · `/pos/points/[id]` | إنشاء/تعديل | `pos.settings` |
| `/pos/sell/[pointId]` | شاشة البيع | `pos.sell` |

## قاعدة البيانات

`database/patch_pos_points.sql`:
- `pos_points`
- `pos_point_payment_methods`
- `pos_point_allowed_materials` / `pos_point_allowed_categories`
- `invoices.pos_point_id`

الترحيل عبر محرك الفواتير الحالي (`saveInvoice` + `post_invoice`) بنمط بيع نقدي.
