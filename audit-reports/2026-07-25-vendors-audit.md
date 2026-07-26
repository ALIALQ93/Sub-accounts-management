# تدقيق دقيق — الموردون (Vendors)

منهجية: قراءة الكود الفعلي (SQL + TypeScript) لواجهة `web/src/app/vendors/page.tsx` والموديول المشترك `web/src/modules/parties/**`، وتتبّع ترتيب تطبيق الـpatches الحقيقي عبر `database/build_setup_all.ps1` (نفس منهجية تقرير العملاء). هذا التقرير **وحدة تدقيق منفصلة** عن `2026-07-25-customers-audit.md` بناءً على طلب صاحب المشروع، لكن الموردين يشتركان مع العملاء في **نفس موديول الأكواد حرفياً** (`web/src/modules/parties/**`) — لذلك القسم §1 يلخّص أثر ذلك، والأقسام التالية تُوثّق كل فجوة بمرجعية الكود الفعلي الخاص بالموردين (`vendors`/`vendor_code`/`payable_account_id`) دون افتراض القارئ اطّلع على التقرير الآخر.

## 1. مشاركة كاملة 100% لموديول العملاء — كل فجوة مشتركة تصيب الطرفين

`web/src/app/vendors/page.tsx` **نفس بنية** `web/src/app/customers/page.tsx` حرفياً (نفس الاستيرادات، نفس التسلسل المنطقي، فقط `kind="vendor"` بدل `kind="customer"`، و`voucherApi.listVendors()`/`createVendor`/`updateVendor` بدل مقابلاتها). يستخدمان **نفس** `PartyFormModal`, `PartySettingsPanel`, `partyApi`. تحقّقت أن الدوال التالية بـ`web/src/modules/parties/services/party-api.ts` هي مسارات موازية حرفياً لمثيلاتها الخاصة بالعملاء، بنفس نقاط الضعف بالضبط:
- `createVendorWithAccount` (`party-api.ts:134-162`) — نفس تدفق `createCustomerWithAccount` (إنشاء حساب ثم إدراج المورد) **بلا معاملة ذرّية** — نفس خطر الحساب اليتيم عند فشل إدراج المورد (تصادم `vendor_code`، خطأ RLS، إلخ).
- `updateVendorWithAccountSync` (`party-api.ts:164-183`) — نفس تحديث بخطوتين منفصلتين (المورد ثم اسم الحساب) بلا ذرّية.
- `generateVendorCode` (`web/src/modules/parties/utils/generate-party-code.ts:41-46`) — نفس `generateCodeFromExisting` بلا أي إعادة محاولة عند تصادم `unique`، خلافاً لتوليد كود الحساب (`create-account-with-code.ts:28-69`).
- لا فحص تكرار اسم المورد إطلاقاً (لا بالواجهة `party-form-modal.tsx:139-168` ولا بقاعدة البيانات).
- `getPartyParentAccountOptions` (`party-parent-accounts.ts:3-15`) نفس fallback الذي قد يسمح باختيار حساب تفصيلي له رصيد كأب لمورد جديد، محوِّلاً إياه تلقائياً إلى تجميعي.
- أزرار `PartyFormModal` (السطور 241-263) نفسها مصمَّمة يدوياً بدل `.btn`/`.btn-primary`/`.btn-outline` — يشمل نافذة إنشاء/تعديل المورد كذلك (الكود مشترك حرفياً، ليس منسوخاً).

**التفاصيل الكاملة لكل بند أعلاه موثّقة بالأدلة والأسطر في `audit-reports/2026-07-25-customers-audit.md` §3-5, §7, §9** — لا أُكرّرها هنا لتفادي التكرار الحرفي المطلوب تفاديه؛ الأقسام التالية تركّز على ما هو **خاص فعلاً بالموردين** أو يحتاج تحققاً منفصلاً بمراجعه الخاصة.

## 2. جدول `vendors` وربطه بحساب الذمم الدائنة

`database/01_schema.sql:135-147`:
```sql
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  vendor_code varchar(30) not null unique,
  name_ar varchar(200) not null,
  phone varchar(50) null,
  email varchar(200) null,
  payable_account_id uuid not null references public.accounts(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
- بنية مطابقة حرفياً لـ`customers` (نفس الأعمدة، فقط `payable_account_id` بدل `receivable_account_id`، و`vendor_code` بدل `customer_code`).
- **لا حقول خاصة بالموردين مطلقاً**: لا رقم ضريبي (VAT/tax number) للمورد، لا شروط دفع افتراضية (payment terms)، لا حساب مصروف/تكلفة افتراضي منفصل عن حساب الذمم الدائنة، لا معلومات بنكية. مقارنة بـ`invoices` التي تحتوي فعلياً حقولاً غنية لكل نوع حساب (`creditor_account_id`, `debtor_account_id`, `cost_account_id`, `inventory_account_id`, `discount_account_id`, `extra_account_id`, `commission_account_id`, `transfer_transit_account_id` — `database/patch_invoices.sql:174-181`)، جدول `vendors` نفسه **بسيط جداً** ولا يحمل أي "حساب افتراضي" (`default_creditor_account_id`/`default_debtor_account_id` بمصطلح المهمة) — الربط الوحيد هو `payable_account_id` واحد لكل مورد، تماماً كما عند العملاء. هذا تصميم متسق (وليس عيباً بحد ذاته) لكنه يعني أن كل حسابات الفاتورة الأخرى (مخزون، تكلفة، خصم) تُحدَّد بمنطق `commercial_kind`/نمط الفاتورة (`invoice_patterns`) لا من سجل المورد نفسه.
- **حماية الحساب المرتبط**: نفس تريغر `customers_vendors_validate_accounts()` (`01_schema.sql:1032-1062`، مرتبط بـ`trg_vendors_validate_accounts` عند `01_schema.sql:2282-2284`) يفرض أن `payable_account_id` يشير إلى حساب `is_postable=true` و`is_active=true` — مطبَّق بشكل صحيح، مطابق تماماً لمسار العملاء.

## 3. RLS على `vendors` — نفس الفجوة المفتوحة بالكامل

`database/02_rls.sql:104-113`:
```sql
create policy "vendors_select_all" on public.vendors for select to authenticated using (true);
create policy "vendors_insert_all" on public.vendors for insert to authenticated with check (true);
create policy "vendors_update_all" on public.vendors for update to authenticated using (true) with check (true);
```
لا `has_permission()`، لا سياسة `DELETE`. مفاتيح `vendors.view`/`vendors.create`/`vendors.edit` (`web/src/modules/settings/permissions/permission-catalog.ts:85-87`) UI-only بحتة — نفس آلية `PermissionGate permission="vendors.create"` (`vendors/page.tsx:144`) و`canEdit = hasPermission("vendors.edit")` (`vendors/page.tsx:17`)، بلا أي إنفاذ خادمي فعلي. أي مستخدم `authenticated` يستطيع إدراج/تعديل موردين مباشرة عبر Supabase client متجاوزاً الواجهة تماماً كما هو الحال مع `customers`.

## 4. الربط بفواتير الشراء

- `invoices.vendor_id uuid null references public.vendors(id) on delete restrict` (`database/patch_invoices.sql:172`)، مع قيد `invoices_single_party` (`patch_invoices.sql:204-206`) يمنع فاتورة واحدة من الإشارة لعميل ومورد معاً — سليم.
- **تحقق نشاط المورد عند حفظ الفاتورة** مطبَّق فعلياً: `invoices_validate_parties()` (`patch_invoices.sql:557-591`) يرفض الحفظ إن كان `vendors.is_active = false` (رسالة الخطأ بالإنجليزية "Referenced vendor must be active." — نفس ملاحظة i18n الموثّقة بتقرير العملاء §7).
- **نفس التحقق مطبَّق على السندات**: `vouchers_validate_parties()` النسخة الفعّالة الحية (`database/patch_reverse_invoice_settlement.sql:16-59`، آخر من يعيد تعريفها حسب ترتيب `build_setup_all.ps1`) تتحقق من `vendors.is_active` أيضاً (السطور 40-44) قبل السماح بربط سند بمورد — سليم ومتّسق مع مسار الفواتير.
- **فلترة الموردين النشطين عند الاختيار بالواجهة**: `VendorSearchField` (`web/src/modules/vouchers/components/vendor-search-field.tsx:24-35`) يفلتر `vendor.is_active` بشكل صحيح قبل عرض الخيارات في فواتير الشراء وسندات الدفع — مطابق تماماً لسلوك `CustomerSearchField`.
- **لا فحص عملة بين المورد وفاتورة الشراء** بشكل مباشر على مستوى `vendors` (لا عمود عملة افتراضية للمورد) — العملة تُحدَّد بالفاتورة/السند نفسه (`currency_id`) بمعزل تام عن سجل المورد، فلا تعارض ممكن هنا تحديداً (خلافاً لخطر خلط العملات الموثَّق بتدقيق السندات على مستوى `voucher_allocations`).

## 5. تعطيل المورد لا يعطّل حساب الذمم الدائنة المرتبط

مطابق تماماً لسلوك العملاء (`vendors/page.tsx:116-131`، `toggleActive`): يستدعي فقط `voucherApi.updateVendor(id, { is_active: false })` بلا لمس `payable_account_id`. الحساب الدائن يبقى نشطاً وقابلاً لاستقبال قيود مباشرة عبر `journal_lines_validate_account_is_postable()` (`01_schema.sql:974-997`) التي تتحقق من حالة **الحساب** فقط لا حالة **المورد**.

## 6. تقرير أعمار الذمم — يخدم الموردين فعلياً لكن بتسمية مضلِّلة جزئياً + خطر مشترك

- `web/src/app/reports/receivables-aging/page.tsx` **يخدم فعلياً كلا الطرفين** عبر مُرشِّح `partyFilter: "customer" | "vendor" | "all"` (السطر 26، خيار "موردون (ذمم دائنة)" بالسطر 114) — فلا حاجة فعلية لتقرير "أعمار الدفعات" منفصل؛ هذا **إيجابي معمارياً** (لا ازدواجية كود).
- لكن **عنوان الصفحة والمسار** ("أعمار الذمم" / `/reports/receivables-aging`) يصفان الذمم المدينة فقط، رغم أن الصفحة نفسها تُستخدم أيضاً لعرض التزامات الموردين (ذمم دائنة) — تسمية مضلِّلة بسيطة قد تربك محاسباً يبحث تحديداً عن "أعمار الموردين"/"أعمار الدفوعات" ولا يجدها كمسار منفصل.
- **نفس خطر تعطّل الاستعلام الموثَّق بتقرير العملاء §6** ينطبق هنا بالكامل وبنفس الحدّة: `open_items_report-api.ts:94-122` يضمّن `vendors ( name_ar )` اعتماداً على `party_id` **بلا FK حقيقي** — إن تعطّل الاستعلام، **يتعطّل عرض أعمار الموردين أيضاً** بنفس الخلل تماماً (مسار كود واحد لكلا الطرفين). راجع تقرير العملاء للتفاصيل الكاملة والاستدلال.

## 7. جدول ملخّص الفجوات (خاص بالموردين + إشارة للمشترك)

| # | الملاحظة | الموقع | الخطورة |
|---|---|---|---|
| 1 | RLS مفتوحة بالكامل (`using(true)`) على `vendors` — صلاحيات `vendors.create/edit` UI-only فقط | `database/02_rls.sql:104-113` | 🔴 حرج |
| 2 | إنشاء مورد+حساب بخطوتين بلا معاملة ذرّية — فشل الخطوة الثانية يترك حساباً يتيماً (مشترك مع العملاء) | `party-api.ts:134-162` | 🔴 حرج |
| 3 | توليد `vendor_code` بلا إعادة محاولة عند تصادم `unique` (مشترك مع العملاء) | `generate-party-code.ts:41-46` | 🟠 عالٍ |
| 4 | لا حماية أو تنبيه من تكرار اسم المورد (مشترك مع العملاء) | `party-api.ts:139-141` | 🟠 عالٍ |
| 5 | استعلام `open_items_view` بتضمين `vendors()` بلا FK حقيقي على `party_id` — خطر تعطّل عرض أعمار الموردين (مشترك مع العملاء) | `open-items-report-api.ts:94-122` | 🟠 عالٍ (يحتاج تحققاً حياً) |
| 6 | تعطيل المورد لا يعطّل حساب الذمم الدائنة المرتبط | `vendors/page.tsx:116-131` | 🟡 متوسط |
| 7 | لا حقول خاصة بالموردين (رقم ضريبي، شروط دفع افتراضية، بيانات بنكية) — بنية مطابقة حرفياً للعملاء | `01_schema.sql:135-147` | 🔵 معماري |
| 8 | تسمية/مسار "أعمار الذمم" يوحي بالذمم المدينة فقط رغم خدمته لأعمار الموردين أيضاً | `reports/receivables-aging/page.tsx` | 🔵 معماري (تسمية) |
| 9 | أزرار `PartyFormModal` مصممة يدوياً بدل `.btn`/`.btn-primary`/`.btn-outline` (مشترك مع العملاء) | `party-form-modal.tsx:241-263` | 🟡 متوسط |
| 10 | رسالة خطأ خام بالإنجليزية "Referenced vendor must be active." تظهر وسط واجهة عربية | `patch_invoices.sql:568-569`، `patch_reverse_invoice_settlement.sql:40-44` | 🟡 متوسط |

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **تحويل إنشاء المورد+الحساب إلى دالة `SECURITY DEFINER` واحدة بمعاملة ذرّية**، بنفس الحل المقترح لدفتر العملاء — نفس الدالة يمكن أن تُعمَّم بمعامل `party_kind: 'customer'|'vendor'` بدل تكرارها.
2. **إضافة `has_permission('vendors.create'/'vendors.edit')` صراحة داخل سياسات RLS على `vendors`** بدل `using(true)`.

### 🟠 عالٍ

3. **التحقق حياً من استعلام `open_items_view` مع `vendors()` المُضمَّن** — نفس التوصية بتقرير العملاء؛ إصلاح واحد يحل المشكلة للطرفين معاً لأن المسار مشترك.
4. **إضافة فحص/تحذير تكرار اسم المورد** بنفس آلية العملاء.
5. **إعادة استخدام منطق إعادة المحاولة عند تصادم `vendor_code`** (نفس نمط `createAccountWithGeneratedCode`).

### 🟡 متوسط

6. **ربط تعطيل المورد بتعطيل حساب الذمم الدائنة المرتبط**، أو تحذير صريح أن الحساب يبقى نشطاً.
7. **توحيد أزرار `PartyFormModal`** — إصلاح واحد يشمل الطرفين لأن الكود مشترك.
8. **تعريب رسائل استثناءات `vendors`/`invoices`** المتعلقة بالمورد.
9. **توضيح تسمية تقرير أعمار الذمم** (مثلاً "أعمار الذمم والدفوعات" أو مسار فرعي `/reports/open-items-aging`) ليعكس خدمته لكلا الطرفين، مع إبقاء منطق الكود المشترك كما هو (لا داعٍ لتقرير منفصل).

### 🔵 معماري

10. **تقييم إضافة حقول خاصة بالموردين** (رقم ضريبي، شروط دفع افتراضية) إن كانت هذه البيانات مطلوبة فعلياً بالتقارير الضريبية/الشرائية المستقبلية — لا حاجة ملحّة حالياً بمرحلة `trial-1`.

## ملحق — ملفات مرجعية رئيسية

- `web/src/app/vendors/page.tsx` — الصفحة الرئيسية، أزرار الصلاحيات، `toggleActive`.
- `web/src/modules/parties/services/party-api.ts` — `createVendorWithAccount`, `updateVendorWithAccountSync` (134-183).
- `web/src/modules/vouchers/components/vendor-search-field.tsx` — فلترة `is_active` عند اختيار المورد.
- `web/src/app/reports/receivables-aging/page.tsx` — يخدم كلا الطرفين عبر `partyFilter`.
- `web/src/modules/reports/services/open-items-report-api.ts` — استعلام `open_items_view` المُضمَّن، خطر §6.
- `database/01_schema.sql` — `vendors` (135-147)، `customers_vendors_validate_accounts()` (1032-1062)، تريغر الربط (2282-2284).
- `database/02_rls.sql` — سياسات `vendors` (104-113).
- `database/patch_invoices.sql` — `invoices.vendor_id` (172)، حقول الحسابات لكل فاتورة (174-181)، `invoices_validate_parties()` (557-591).
- `database/patch_reverse_invoice_settlement.sql` — النسخة الفعّالة النهائية من `vouchers_validate_parties()` (16-59)، تحقق نشاط المورد (40-44).
- `web/src/modules/settings/permissions/permission-catalog.ts` — مفاتيح `vendors.*` (UI-only).
- **راجع أيضاً**: `audit-reports/2026-07-25-customers-audit.md` — التفاصيل الكاملة (بالأسطر) لكل فجوة مشتركة عبر موديول `parties` (إنشاء/تعديل بلا ذرّية، توليد الكود، تكرار الاسم، اختيار الحساب الأب، أزرار المودال).
