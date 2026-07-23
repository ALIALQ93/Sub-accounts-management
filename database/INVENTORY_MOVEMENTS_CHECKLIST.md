# قائمة تحقق — `inventory_movements` عند تعديل `post_invoice`

أي تغيير على أعمدة الحركة (مثل `expiry_date` / `serial_number` / التكلفة) يستوجب مراجعة **كل** مواضع الإدراج في النسخة الفعّالة من `post_invoice()` داخل `patch_invoice_pricing_cost.sql` (وأي patch لاحق يعيد تعريفها).

## دلالة `movement_kind`

| القيمة | الاتجاه | المعنى |
|--------|---------|--------|
| `sale` | إخراج (−) | بيع |
| `purchase` | إدخال (+) | شراء |
| `transfer_out` | إخراج (−) | مناقلة — شحن من المصدر |
| `transfer_in` | إدخال (+) | مناقلة — استلام في الوجهة |
| `return_sale` | إدخال (+) | مرتجع مبيعات |
| `return_purchase` | إخراج (−) | مرتجع مشتريات |
| `opening_stock` | إدخال (+) | رصيد افتتاحي |
| `adjustment` | ± | تسوية مخزون |

الرصيد والتكلفة = `SUM` لحظي على هذا الدفتر (لا يوجد جدول رصيد مُخزَّن حالياً).

## مواضع الإدراج في `post_invoice` (تحقق يدوياً)

عند إضافة عمود جديد للحركة، مرّ على كل `insert into public.inventory_movements` في `post_invoice` وتأكد من:

1. البيع (`sale`)
2. الشراء (`purchase`)
3. مناقلة صادرة (`transfer_out`)
4. مناقلة واردة (`transfer_in`) — راعِ `qty_received` و`quantity_base_delta`
5. مرتجع بيع (`return_sale`)
6. مرتجع شراء (`return_purchase`)
7. أي مسار إضافي أُضيف لاحقاً في نفس الدالة

## تريغرز `BEFORE INSERT` (الترتيب الأبجدي مهم)

1. `trg_inventory_movements_00_explode_composite` — تفجير مركّب
2. `trg_inventory_movements_05_fill_tracking` — نسخ صلاحية/تسلسلي من سطر الفاتورة (**قبل** فحص الرصيد)
3. `trg_inventory_movements_apply_invoice_line_cost` — تكلفة السطر
4. `trg_inventory_movements_enforce_stock` — رصيد + دفعة + قفل advisory

لا تُعد تسمية تريغر بدون التحقق أن `fill_tracking` يبقى قبل `enforce_stock`.

## تحويل الوحدات

- SQL (مرجع الحفظ): `material_units_sync_conversion` في `patch_materials_card_v2.sql`
- واجهة (معاينة): `web/src/modules/materials/utils/unit-conversion.ts` → `computeFactorToBase`
