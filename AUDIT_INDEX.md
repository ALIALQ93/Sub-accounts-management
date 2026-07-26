# فهرس التدقيق — التقارير المفتوحة فقط

تقارير التدقيق المُنجَزة (مُغلقة بالكامل) حُذفت في 2026-07-26. هذا الفهرس يحتفظ فقط بما لا يزال فيه بنود مفتوحة أو جزئية.

المنهجية بكل تقرير: قراءة الكود الفعلي وتتبّع ترتيب تطبيق الباتشات الحقيقي (`database/build_setup_all.ps1`) — `database/setup_all.sql` هو النسخة المُجمَّعة الفعّالة؛ آخر `create or replace` لأي دالة/تريغر/سياسة هو الفعّال.

---

## 🔴 أولوية حرجة (مختارة من التقارير المتبقية)

1. **تصعيد صلاحيات** — `settings.users.manage` / `settings.permissions.manage` → أدمن كامل. ([`users-audit.md`](audit-reports/2026-07-25-users-audit.md), [`permissions-audit.md`](audit-reports/2026-07-25-permissions-audit.md))
2. **كشف الحساب** — بنود جزئية متبقية (سعر حي لعملة ثالثة، …). ([`account-statement-audit.md`](audit-reports/2026-07-25-account-statement-audit.md))
3. **تعديل سند دفع/قبض مرحّل** + مسار عكس ميت. ([`payment-receipt-vouchers-audit.md`](audit-reports/2026-07-25-payment-receipt-vouchers-audit.md))
4. **قيد يومية مرحّل قابل للتعديل** بلا حماية كافية. ([`journals-audit.md`](audit-reports/2026-07-25-journals-audit.md))
5. **نموذج الفاتورة: ترحيل بلا حفظ** يرحّل بيانات قديمة. ([`invoice-form-audit.md`](audit-reports/2026-07-25-invoice-form-audit.md))
6. **سند التسوية / القيد الافتتاحي** — بنود حرجة مفتوحة. ([`settlement-voucher-audit.md`](audit-reports/2026-07-25-settlement-voucher-audit.md), [`opening-entry-audit.md`](audit-reports/2026-07-25-opening-entry-audit.md))
7. **فئات سطور السندات** بلا صلاحية DB لـ`auto_post_enabled`. ([`voucher-line-categories-audit.md`](audit-reports/2026-07-25-voucher-line-categories-audit.md))
8. **مناقلات المخزون** — زر استلام يتكرر. ([`inventory-transfers-audit.md`](audit-reports/2026-07-25-inventory-transfers-audit.md))
9. **RLS مفتوحة** على عملاء/موردين/مراكز كلف/عملات. ([`customers-audit.md`](audit-reports/2026-07-25-customers-audit.md), [`vendors-audit.md`](audit-reports/2026-07-25-vendors-audit.md), [`cost-centers-audit.md`](audit-reports/2026-07-25-cost-centers-audit.md), [`currencies-audit.md`](audit-reports/2026-07-25-currencies-audit.md))
10. **`bulk_create_accounts()`** بلا فحص صلاحية. ([`accounts-audit.md`](audit-reports/2026-07-25-accounts-audit.md))
11. **إعداد أولي** — أدمن ثانٍ إن انفرغ جدول المستخدمين. ([`setup-audit.md`](audit-reports/2026-07-25-setup-audit.md))

## 🟠 أولوية عالية / جزئية

- أنماط الفواتير: قيود مواد/أصناف بلا تنفيذ خلفي لفواتير عادية. ([`invoice-patterns-audit.md`](audit-reports/2026-07-25-invoice-patterns-audit.md))
- فروع وإعدادات شركة. ([`branches-audit.md`](audit-reports/2026-07-25-branches-audit.md), [`company-settings-audit.md`](audit-reports/2026-07-25-company-settings-audit.md))
- ميزان مراجعة / سطور مبيعات ومشتريات — تحسينات أو فحص RPC ما زال مفتوحاً. ([`trial-balance-audit.md`](audit-reports/2026-07-25-trial-balance-audit.md), [`sales-lines-report-audit.md`](audit-reports/2026-07-25-sales-lines-report-audit.md), [`purchase-lines-report-audit.md`](audit-reports/2026-07-25-purchase-lines-report-audit.md))
- فترات محاسبية. ([`accounting-periods-audit.md`](audit-reports/2026-07-25-accounting-periods-audit.md))
- حركات مفتوحة / واجهة مواد جزئية / POS بيع. ([`open-movements-audit.md`](audit-reports/2026-07-25-open-movements-audit.md), [`materials-ui-categories-audit.md`](audit-reports/2026-07-25-materials-ui-categories-audit.md), [`pos-sell-audit.md`](audit-reports/2026-07-25-pos-sell-audit.md))

## 🟡 معماري / قديم جزئي

- تشتت `post_invoice()` / تريغرات — [`2026-07-22-general-audit.md`](audit-reports/2026-07-22-general-audit.md)
- حسابات/سندات (بنود مفتوحة) — [`2026-07-22-accounts-vouchers-audit.md`](audit-reports/2026-07-22-accounts-vouchers-audit.md)
- مواد/مستودعات (RLS فرع / رصيد مُخزَّن معماريان) — [`2026-07-22-materials-warehouses-audit.md`](audit-reports/2026-07-22-materials-warehouses-audit.md)
- فواتير (بنود معلّقة) — [`2026-07-23-invoices-audit.md`](audit-reports/2026-07-23-invoices-audit.md)
- [`AUDIT_INVOICES_JOURNAL.md`](AUDIT_INVOICES_JOURNAL.md) — #2 FIFO و#3 استلام جزئي لم يُعاد التحقق منهما

---

## فهرس التقارير المتبقية

| المجال | التقارير |
|--------|----------|
| حسابات وأطراف | [`accounts`](audit-reports/2026-07-25-accounts-audit.md) · [`cost-centers`](audit-reports/2026-07-25-cost-centers-audit.md) · [`currencies`](audit-reports/2026-07-25-currencies-audit.md) · [`customers`](audit-reports/2026-07-25-customers-audit.md) · [`vendors`](audit-reports/2026-07-25-vendors-audit.md) |
| سندات وقيود | [`payment-receipt`](audit-reports/2026-07-25-payment-receipt-vouchers-audit.md) · [`settlement`](audit-reports/2026-07-25-settlement-voucher-audit.md) · [`opening-entry`](audit-reports/2026-07-25-opening-entry-audit.md) · [`voucher-line-categories`](audit-reports/2026-07-25-voucher-line-categories-audit.md) · [`journals`](audit-reports/2026-07-25-journals-audit.md) · [`open-movements`](audit-reports/2026-07-25-open-movements-audit.md) |
| فواتير ومخزون | [`invoice-form`](audit-reports/2026-07-25-invoice-form-audit.md) · [`invoice-patterns`](audit-reports/2026-07-25-invoice-patterns-audit.md) · [`inventory-transfers`](audit-reports/2026-07-25-inventory-transfers-audit.md) |
| مواد / POS جزئي | [`materials-ui-categories`](audit-reports/2026-07-25-materials-ui-categories-audit.md) · [`pos-sell`](audit-reports/2026-07-25-pos-sell-audit.md) |
| تقارير | [`trial-balance`](audit-reports/2026-07-25-trial-balance-audit.md) · [`account-statement`](audit-reports/2026-07-25-account-statement-audit.md) · [`sales-lines`](audit-reports/2026-07-25-sales-lines-report-audit.md) · [`purchase-lines`](audit-reports/2026-07-25-purchase-lines-report-audit.md) |
| إعدادات وأمان | [`company-settings`](audit-reports/2026-07-25-company-settings-audit.md) · [`branches`](audit-reports/2026-07-25-branches-audit.md) · [`accounting-periods`](audit-reports/2026-07-25-accounting-periods-audit.md) · [`permissions`](audit-reports/2026-07-25-permissions-audit.md) · [`users`](audit-reports/2026-07-25-users-audit.md) · [`setup`](audit-reports/2026-07-25-setup-audit.md) |
| أقدم (جزئي) | [`general`](audit-reports/2026-07-22-general-audit.md) · [`accounts-vouchers`](audit-reports/2026-07-22-accounts-vouchers-audit.md) · [`materials-warehouses`](audit-reports/2026-07-22-materials-warehouses-audit.md) · [`invoices`](audit-reports/2026-07-23-invoices-audit.md) · [`AUDIT_INVOICES_JOURNAL`](AUDIT_INVOICES_JOURNAL.md) |
