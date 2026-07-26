# تدقيق دقيق — العملاء (Customers)

منهجية: قراءة الكود الفعلي (SQL + TypeScript) لواجهة `web/src/app/customers/page.tsx` والموديول المشترك `web/src/modules/parties/**`، وتتبّع ترتيب تطبيق الـpatches الحقيقي عبر `database/build_setup_all.ps1` — لأن دوالاً مثل `vouchers_validate_parties()` أُعيد تعريفها أكثر من مرة عبر عدة ملفات patch، والنسخة الفعّالة هي آخر ملف يعيد تعريفها حسب ترتيب البناء الحقيقي (`patch_reverse_invoice_settlement.sql`)، وليست أول نتيجة بحث نصي. تحققتُ أيضاً أن ملفي `patch_admin_edit_posted_vouchers.sql` و`patch_voucher_delete.sql` (يحتويان نسخاً أقدم من نفس الدالة) **غير مستدعاة من `build_setup_all.ps1`** فلا تنفَّذ اليوم.

## 0. البنية المعمارية — وحدة واحدة مشتركة 100% بين العملاء والموردين

`web/src/app/customers/page.tsx` و`web/src/app/vendors/page.tsx` **نفس المكوّن الوظيفي حرفياً** فقط بتبديل `kind="customer"`/`kind="vendor"`: نفس `PartyFormModal`، نفس `PartySettingsPanel`، نفس `partyApi` (`web/src/modules/parties/services/party-api.ts`)، ونفس نمط SQL (`customers`/`vendors` جدولان متطابقان في البنية بالكامل، انظر `database/01_schema.sql:121-147`). **أي خلل في منطق الإنشاء/التعديل المشترك يصيب الطرفين معاً** — موثّق بالتفصيل في هذا التقرير لأن العملاء هو الوحدة الأساس، وتقرير الموردين (`2026-07-25-vendors-audit.md`) يشير إليه بدل التكرار الحرفي.

## 1. جدول `customers` وربطه بحساب الذمم

`database/01_schema.sql:121-133`:
```
customer_code varchar(30) not null unique
receivable_account_id uuid not null references public.accounts(id) on delete restrict
```
- **لا حقل `credit_limit`** (حد ائتمان) في الجدول ولا في أي مكان بالمشروع — بحث شامل (`grep -rn "credit_limit"`) لم يُظهر أي أثر لا بقاعدة البيانات ولا بالواجهة. أي ضبط لسقف ذمم العميل غير موجود إطلاقاً، لا تحذيرياً ولا منعياً.
- **لا حقل رصيد افتتاحي على مستوى العميل** — وهذا **متسق** مع تصميم بقية النظام: لا `accounts.opening_balance` أيضاً؛ الرصيد الافتتاحي يُدخَل عبر سند افتتاحي مخصّص (`database/patch_opening_entry.sql:1-17`، صلاحية `vouchers.create`) يُنشئ قيداً بعلم `is_opening_entry`، وليس حقلاً ثابتاً على السجل. هذا **ليس فجوة** بل نمط مقصود ومتّبع في كل الحسابات — لكن **لا يوجد رابط مباشر من نموذج/صف العميل** (`PartyFormModal`، `customers/page.tsx`) إلى شاشة إنشاء سند افتتاحي لحسابه، خلافاً لكشف الحساب الذي له رابط مباشر (`customers/page.tsx:213-225`). فجوة UX بسيطة فقط.
- **حماية حساب الذمم**: تريغر `customers_vendors_validate_accounts()` (`01_schema.sql:1032-1062`، مرتبط `before insert or update on customers` بـ`01_schema.sql:2274-2276`) يمنع ربط عميل بحساب غير قابل للترحيل (`is_postable=false`) أو غير نشط (`is_active=false`) — جيد ومطبَّق فعلياً في مسار الإنشاء والتعديل.
- **لا FK حقيقي على `journal_entry_lines.party_id`** تجاه `customers.id`/`vendors.id` (انظر §6) — التحقق فقط عبر تريغر تطبيقي (`database/patch_journal_dimensions.sql:69-71`)، وليس قيد قاعدة بيانات صريحاً.
- لا حقول خاصة بالعميل (رقم ضريبي، عنوان، شروط دفع افتراضية، جهة اتصال) — فقط `phone`/`email` نصيّان بلا أي تحقق تنسيق.

## 2. RLS مفتوحة بالكامل — بلا `has_permission()`

`database/02_rls.sql:93-102`:
```sql
create policy "customers_select_all" on public.customers for select to authenticated using (true);
create policy "customers_insert_all" on public.customers for insert to authenticated with check (true);
create policy "customers_update_all" on public.customers for update to authenticated using (true) with check (true);
```
لا سياسة `DELETE` (فتظل ممنوعة افتراضياً — جيد، يتفق مع عدم وجود زر حذف فعلي بالواجهة، فقط تعطيل `is_active`).

**نموذج الصلاحيات UI-only بالكامل** — مطابق تماماً لنمط تم توثيقه سابقاً بتدقيق الحسابات/السندات (`2026-07-22-accounts-vouchers-audit.md` §5/#7):
- مفاتيح `customers.view`/`customers.create`/`customers.edit` موجودة فقط في `web/src/modules/settings/permissions/permission-catalog.ts:76-78` وتُستخدم لإخفاء الأزرار (`PermissionGate permission="customers.create"` في `customers/page.tsx:145`) وتعطيل قائمة الإجراءات (`canEdit` في `customers/page.tsx:17,240`).
- **التحقق من `customers.view` نفسه client-side بحت**: `web/src/modules/settings/permissions/permission-utils.ts:62` يربط `/customers` بصلاحية `customers.view`، لكن الإنفاذ الوحيد هو `useEffect` بـ`web/src/components/app-shell.tsx:55-58` الذي يُعيد التوجيه بعد الرندر — **لا حارس على مستوى الخادم/middleware**.
- بما أن العميل يتصل مباشرة بـSupabase (لا API وسيطة)، أي مستخدم `authenticated` — حتى دور `viewer` بلا صلاحية `customers.create` مضبوطة — يستطيع تقنياً استدعاء `supabase.from('customers').insert(...)`/`.update(...)` مباشرة عبر devtools/console متجاوزاً كل قيود الواجهة. هذا **يطابق حرفياً** الفجوة الموثّقة سابقاً على `accounts`/`vouchers`، والآن مؤكَّدة أيضاً على `customers`.

## 3. تدفق الإنشاء — عملية من خطوتين بلا معاملة ذرّية (orphan account risk)

`web/src/modules/parties/services/party-api.ts:83-111` (`createCustomerWithAccount`):
```ts
const account = await createLinkedAccount(values.parent_account_id, values.name_ar, allAccounts); // (1) إنشاء حساب فرعي
const customerCode = generateCustomerCode(customers);                                              // (2) توليد كود
return voucherApi.createCustomer({ customer_code: customerCode, ..., receivable_account_id: account.id }); // (3) إدراج العميل
```
- الخطوة (1) تُنشئ حساباً فعلياً بقاعدة البيانات (`createAccountWithGeneratedCode`، `web/src/modules/accounts/utils/create-account-with-code.ts:28-69`) **قبل** أي محاولة لإدراج العميل نفسه.
- إن فشلت الخطوة (3) لأي سبب (تصادم `customer_code` — انظر §4، رسالة خطأ RLS، فشل شبكة، انتهاك `check` على `name_ar`) فإن **الحساب الذي أُنشئ بالخطوة (1) يبقى قائماً بلا أي عميل مرتبط به** — لا rollback ولا تنظيف. النتيجة: حساب "يتيم" ضمن شجرة الحسابات باسم العميل الفاشل إنشاؤه، يظهر لاحقاً في `AccountSearchField`/التقارير كحساب عادي قابل للترحيل بلا أي ربط منطقي، وقد يُستخدم بالخطأ لاحقاً.
- **لا معاملة (transaction) ولا RPC واحدة تُنفّذ الخطوتين ذرّياً** — خلافاً لدوال حرجة أخرى بالمشروع (`post_invoice()`, `reverse_posted_voucher()`) المنفَّذة كـ`SECURITY DEFINER` بمعاملة واحدة على الخادم.
- **نفس النمط بالضبط عند التعديل**: `updateCustomerWithAccountSync` (`party-api.ts:113-132`) يحدّث العميل أولاً ثم يحدّث اسم الحساب في نداء منفصل؛ فشل النداء الثاني يترك اسم العميل واسم حساب الذمم **غير متطابقين** بصمت (لا رسالة توضّح أن التزامن جزئي).

## 4. توليد `customer_code` — بلا حماية تصادم، خلافاً لتوليد كود الحساب

`web/src/modules/parties/utils/generate-party-code.ts:10-32` يولّد `CUST-###` بحساب `max(existing)+1` على العميل (client-side فقط)، **بلا أي إعادة محاولة عند تصادم**. قارِن هذا بـ`createAccountWithGeneratedCode` (`web/src/modules/accounts/utils/create-account-with-code.ts:28-69`) التي **صُمِّمت خصيصاً** لهذا السيناريو: تكتشف خطأ `unique constraint`/`23505` وتُعيد المحاولة حتى 8 مرات بكود جديد.
- `customers.customer_code` **فريد فعلياً بقيد `unique`** (`01_schema.sql:123`)، فتصادمان متزامنان (تبويبان مفتوحان، أو نقرتان سريعتان) في حساب `next = max+1` نفسه يؤديان إلى فشل الإدراج الثاني برسالة Postgres خام غير مترجمة (`duplicate key value violates unique constraint "customers_customer_code_key"`) تظهر كما هي فى `formError` بالواجهة (`customers/page.tsx:111`) — تجربة مستخدم سيئة وليست فقط نظرية، خاصة أن كود العميل يُحسب مرة واحدة عند فتح النافذة (`party-form-modal.tsx:110-115`) فلا يتحدّث تلقائياً بعد فشل أول محاولة.
- هذا **يفاقم** فجوة الحساب اليتيم بـ§3: عند تصادم كود العميل، الحساب الفرعي المرتبط يكون **قد أُنشئ فعلاً** (الخطوة 1 قبل الخطوة 3)، فيتكرر السيناريو اليتيم تحديداً بهذا المسار الشائع نسبياً (نقرة مزدوجة على زر "إضافة").

## 5. لا حماية من تكرار اسم العميل — لا بالواجهة ولا بقاعدة البيانات

- `createCustomerWithAccount` (`party-api.ts:88-90`) يتحقق فقط أن `name_ar` غير فارغ — **لا أي فحص لوجود عميل بنفس الاسم** (لا مطابقة حرفية ولا تقريبية).
- لا قيد `unique`/`check` على `customers.name_ar` بقاعدة البيانات (`01_schema.sql:121-131`).
- بما أن اسم العميل يُستنسخ تلقائياً كاسم لحساب الذمم الفرعي (`createLinkedAccount`, `party-api.ts:39-45`)، إنشاء عميلين بنفس الاسم بالخطأ ينتج **حسابين مختلفين بنفس `name_ar`** يميّزهما فقط الكود المولَّد آلياً — خطر واقعي لمحاسب يعمل يدوياً بسرعة (مطابق لنمط "تكرار الاسم" المذكور بتدقيقات سابقة على وحدات أخرى من المشروع).

## 6. الربط بتقرير أعمار الذمم — خطر عطل فعلي غير مختبَر حياً

`web/src/modules/reports/services/open-items-report-api.ts:94-114` يستعلم `open_items_view` عبر Supabase/PostgREST مع تضمين علاقات مُدمجة (embedded resources):
```ts
.select(`..., party_type, party_id, ..., customers ( name_ar ), vendors ( name_ar )`)
```
هذا النمط (`table ( columns )`) في PostgREST **يتطلب علاقة foreign key حقيقية مُكتشَفة من schema cache** بين العمود المصدر والجدول الهدف. لكن:
- `open_items_view` مبني فوق `journal_entry_lines.party_id` (`database/patch_journal_dimensions.sql:23-27`)، وهذا العمود **بلا أي `references` صريح** تجاه `customers`/`vendors` — التحقق فقط عبر تريغر تطبيقي (`patch_journal_dimensions.sql:69-75`) وليس قيد `foreign key` حقيقياً (تأكدتُ ببحث شامل: `grep "party_id.*references"` بلا أي نتيجة بكامل `database/`).
- **قارِن بنمط مطابق يعمل بشكل صحيح** في `web/src/modules/invoices/services/invoice-api.ts:173-174` (نفس صياغة `customers ( name_ar ), vendors ( name_ar )`) — لكن هناك يعمل لأن `invoices.customer_id`/`invoices.vendor_id` هما **FK حقيقيان** (`database/patch_invoices.sql:171-172`).
- بدون FK حقيقي على `party_id`، الأرجح تقنياً أن PostgREST يرفض هذا الاستعلام بخطأ علاقة غير موجودة (عادة كود `PGRST200`)، أو يعيد `customers`/`vendors` كـ`null` دوماً. **دالة معالجة الخطأ في نفس الملف تتجاهل فقط أكواد `42P01`/`PGRST205`** (`isMissingView`, السطر 6-8) — أي خطأ آخر مثل `PGRST200` **يُرمى كاستثناء غير معالَج** (`throw new Error(error.message)`, السطر 122)، فيتعطّل تقرير أعمار الذمم بالكامل (`web/src/app/reports/receivables-aging/page.tsx`) لكلا نوعي الطرف.
- **لم أتحقق من هذا حياً على قاعدة بيانات فعلية** (تدقيق ثابت للكود فقط) — لكن الدليل النصي (غياب أي FK على `party_id` بكامل المستودع، مقابل وجوده الصريح على `invoices`) قوي بما يكفي لاعتباره خللاً مرجّحاً يستحق فحصاً فورياً على بيئة حقيقية قبل الاعتماد على هذا التقرير في الإقفال الشهري.

## 7. اتساق الواجهة (UI/UX)

- **`Modal` المشترك مُستخدَم بشكل صحيح** (`web/src/modules/parties/components/party-form-modal.tsx:5,139-150` يستورد ويستخدم `@/components/modal`) — لا مودال مُعاد اختراعه هنا، بخلاف ما وُجد بوحدات أخرى سابقاً.
- **لكن أزرار الحفظ/الإلغاء داخل `PartyFormModal` مصمَّمة يدوياً** (`party-form-modal.tsx:241-263`) بأصناف Tailwind خام (`bg-[var(--brand-navy)] px-4 py-2 ...`) **بدل** أصناف النظام الموحّدة `.btn .btn-primary`/`.btn .btn-outline` المعرَّفة بـ`web/src/app/globals.css:123-176` والمستخدَمة في نفس الصفحة الأم (`customers/page.tsx:146`: `className="btn btn-primary"`، وأزرار "تعديل/تعطيل" بالجدول: `btn btn-sm btn-outline`). هذا تضارب بصري طفيف (نصف قطر حواف، حشوة، سلوك `:disabled` مختلف احتمالاً) بين نفس الشاشة ونافذتها المنبثقة.
- **رسائل خطأ خام بالإنجليزية من تريغرات القاعدة تظهر كما هي بالواجهة العربية**: مثال `"Referenced customer must be active."` (`database/patch_invoices.sql:568`) أو `"Linked receivable/payable account must be active."` (`01_schema.sql:1057`) — أي مسار يُطلق هذه الاستثناءات (مثلاً فاتورة على عميل عُطِّل للتو) يعرض رسالة إنجليزية وسط واجهة عربية بالكامل.
- شارة الحالة (`badge-success`/`badge-muted`) وزر "تعطيل" بلون `text-[var(--warning)]` (`customers/page.tsx:254`) متسقان مع توكِنات النظام (`--danger`/`--success` مستخدَمة بشكل صحيح لرسائل `loadError`/`success`، أسطر 166-174).

## 8. تعطيل العميل لا يعطّل حسابه المرتبط

`toggleActive` (`customers/page.tsx:117-132`) يستدعي فقط `voucherApi.updateCustomer(id, { is_active: false })` — **لا يمسّ `receivable_account_id` إطلاقاً**. حساب الذمم يبقى `is_active=true` وقابلاً للترحيل المباشر (`journal_lines_validate_account_is_postable()`, `01_schema.sql:974-997`, تتحقق فقط من حالة **الحساب** لا حالة **العميل**). العميل المعطَّل عبر الواجهة **يظل حسابه** قابلاً لاستقبال قيود يدوية مباشرة (بما أن RLS على `journal_entries`/`journal_entry_lines` مفتوحة أيضاً حسب تدقيق سابق) — تعطيل العميل بالتالي إجراء عرضي/تنظيمي فقط، لا ضبط محاسبي فعلي فعليّ لحسابه.

## 9. مخاطرة هرمية عند اختيار حساب أب غير موجود مسبقاً

`web/src/modules/parties/utils/party-parent-accounts.ts:3-15`:
```ts
const nonPostable = accounts.filter(a => a.is_active && !a.is_postable);
if (nonPostable.length > 0) return nonPostable...
return accounts.filter(a => a.is_active).sort(...); // fallback: كل الحسابات النشطة، بما فيها القابلة للترحيل
```
إن لم تكن هناك بعد أي حسابات تجميعية (`is_postable=false`) — سيناريو محتمل بمشروع بحالة `trial-1` بمرحلة إعداد مبكرة — تُعرَض **كل** الحسابات النشطة كخيارات "حساب أب"، بما فيها حسابات تفصيلية قابلة للترحيل ولها حركات فعلية. اختيار محاسب بالخطأ لحساب تفصيلي كأب لعميل جديد يُفعِّل قاعدة الهرمية `accounts_apply_hierarchy_rules()` (موثّقة بتدقيق سابق، `01_schema.sql:504-578`) التي **تحوّل الحساب الأب تلقائياً إلى غير قابل للترحيل** بمجرد إضافة الابن — فيُجمَّد أي حساب تفصيلي موجود مسبقاً وله رصيد، ويصبح غير قابل لاستقبال قيود جديدة مباشرة دون أي تحذير مسبق بنافذة إنشاء العميل.

## 10. جدول ملخّص الفجوات

| # | الملاحظة | الموقع | الخطورة |
|---|---|---|---|
| 1 | RLS مفتوحة بالكامل (`using(true)`) على `customers` — صلاحيات `customers.create/edit` UI-only فقط | `database/02_rls.sql:93-102` | 🔴 حرج |
| 2 | إنشاء عميل+حساب بخطوتين بلا معاملة ذرّية — فشل الخطوة الثانية يترك حساباً يتيماً | `party-api.ts:83-111` | 🔴 حرج |
| 3 | توليد `customer_code` بلا إعادة محاولة عند تصادم `unique` (خلافاً لتوليد كود الحساب) | `generate-party-code.ts:10-32` | 🟠 عالٍ |
| 4 | لا حماية أو تنبيه من تكرار اسم العميل — لا بالواجهة ولا بقاعدة البيانات | `party-api.ts:88-90`, `01_schema.sql:121-131` | 🟠 عالٍ |
| 5 | استعلام `open_items_view` بتضمين `customers()`/`vendors()` بلا FK حقيقي على `party_id` — خطر تعطّل تقرير أعمار الذمم | `open-items-report-api.ts:94-122`, `patch_journal_dimensions.sql:23-27` | 🟠 عالٍ (يحتاج تحققاً حياً) |
| 6 | تعطيل العميل لا يعطّل حساب الذمم المرتبط — الحساب يبقى قابلاً للترحيل المباشر | `customers/page.tsx:117-132` | 🟡 متوسط |
| 7 | اختيار حساب أب من كل الحسابات النشطة (fallback) قد يحوّل حساباً تفصيلياً له رصيد إلى تجميعي بالخطأ | `party-parent-accounts.ts:3-15` | 🟡 متوسط |
| 8 | لا حقل `credit_limit` (حد ائتمان) على العميل إطلاقاً | — | 🔵 معماري |
| 9 | أزرار حفظ/إلغاء بـ`PartyFormModal` مصممة يدوياً بدل `.btn`/`.btn-primary`/`.btn-outline` | `party-form-modal.tsx:241-263` | 🟡 متوسط |
| 10 | رسائل خطأ خام بالإنجليزية من تريغرات القاعدة تظهر وسط واجهة عربية | `patch_invoices.sql:568`, `01_schema.sql:1057` | 🟡 متوسط |
| 11 | لا رابط مباشر من صف/نموذج العميل إلى إنشاء سند افتتاحي لحسابه | `customers/page.tsx`, `party-form-modal.tsx` | 🔵 معماري |
| 12 | تحديث الاسم بخطوتين منفصلتين (عميل ثم حساب) — فشل جزئي يترك الاسمين غير متطابقين بصمت | `party-api.ts:113-132` | 🟡 متوسط |

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **تحويل إنشاء العميل+الحساب إلى دالة `SECURITY DEFINER` واحدة بمعاملة ذرّية** (RPC مشابهة لـ`post_invoice()`) بدل خطوتين منفصلتين من العميل — يمنع الحساب اليتيم عند فشل أي خطوة، ويحل أيضاً مشكلة السباق على `customer_code` إن نُقل توليد الكود إلى داخل نفس الدالة (`nextval`/قفل صف).
2. **إضافة `has_permission('customers.create'/'customers.edit')` صراحة داخل سياسات RLS على `customers`** بدل `using(true)`/`with check(true)` — يسد الفجوة التي تسمح لأي مستخدم `authenticated` بإدراج/تعديل عملاء مباشرة عبر استدعاء Supabase من المتصفح متجاوزاً الواجهة.

### 🟠 عالٍ

3. **التحقق حياً من استعلام `open_items_view` مع `customers()`/`vendors()` المُضمَّن** على بيئة Supabase فعلية؛ إن كان يفشل فعلاً، إما إضافة FK حقيقي على `journal_entry_lines.party_id` (صعب لأنه polymorphic)، أو تفكيك العلاقة المُضمَّنة إلى استعلامين منفصلين + دمج client-side (كما تفعل صفحات العملاء/الموردين نفسها فعلاً عبر `accountsById`).
4. **إضافة فحص تكرار اسم قبل الحفظ** (تحذير غير حاجز على الأقل: "يوجد عميل بنفس الاسم — {code} — هل تريد المتابعة؟") في `PartyFormModal`/`party-api.ts`.
5. **تطبيق نفس منطق إعادة المحاولة عند تصادم `customer_code`** المستخدَم فعلاً في `createAccountWithGeneratedCode` — أو أفضل: توليد الكود داخل RPC ذرّية بقفل صف (`select ... for update` على آخر كود).

### 🟡 متوسط

6. **ربط تعطيل العميل بتعطيل حساب الذمم المرتبط** (أو تحذير صريح بالواجهة أن الحساب يبقى نشطاً)، لضمان أن "تعطيل" له أثر محاسبي حقيقي لا تنظيمي فقط.
7. **توحيد أزرار `PartyFormModal`** لاستخدام `.btn .btn-primary`/`.btn .btn-outline` بدل الأصناف اليدوية.
8. **تعريب رسائل استثناءات تريغرات `customers`/`vendors`/`invoices`** أو التقاطها وترجمتها بطبقة `throwIfSupabaseError` بدل عرض النص الخام.
9. **تقييد قائمة "حساب الأب" في `getPartyParentAccountOptions`** لعدم عرض حسابات قابلة للترحيل لها حركات فعلية كخيار أب، حتى في حالة الـfallback.

### 🔵 معماري

10. **النظر في إضافة `credit_limit` اختياري على `customers`** مع تحذير (غير حاجز بالضرورة) عند تجاوز رصيد العميل المدين للحد عند إنشاء فاتورة/سند جديد — ميزة شائعة الطلب من المحاسبين رغم غيابها التام حالياً.
11. **إضافة رابط مباشر من نموذج/صف العميل لإنشاء سند افتتاحي** لحسابه إن لم يكن له رصيد افتتاحي مسجَّل بعد، تحسيناً لتجربة الإعداد الأولي.

## ملحق — ملفات مرجعية رئيسية

- `web/src/app/customers/page.tsx` — الصفحة الرئيسية، أزرار الصلاحيات، `toggleActive`.
- `web/src/modules/parties/components/party-form-modal.tsx` — نموذج الإنشاء/التعديل المشترك (customer/vendor).
- `web/src/modules/parties/components/party-settings-panel.tsx` — إعداد الحساب الأب الافتراضي.
- `web/src/modules/parties/services/party-api.ts` — `createCustomerWithAccount`, `updateCustomerWithAccountSync` (83-132).
- `web/src/modules/parties/utils/generate-party-code.ts` — توليد `customer_code` بلا إعادة محاولة.
- `web/src/modules/parties/utils/party-parent-accounts.ts` — منطق fallback لخيارات الحساب الأب.
- `web/src/modules/accounts/utils/create-account-with-code.ts` — نمط إعادة المحاولة الصحيح (للمقارنة).
- `web/src/modules/vouchers/components/customer-search-field.tsx` — فلترة `is_active` بالواجهة عند اختيار العميل.
- `web/src/modules/reports/services/open-items-report-api.ts` — استعلام `open_items_view` المُضمَّن، خطر §6.
- `web/src/app/reports/receivables-aging/page.tsx` — تقرير أعمار الذمم (يشمل العملاء والموردين).
- `database/01_schema.sql` — `customers` (121-133)، `vendors` (135-147)، `customers_vendors_validate_accounts()` (1032-1062)، تريغرات الربط (2270-2284)، `journal_lines_validate_account_is_postable()` (974-997).
- `database/02_rls.sql` — سياسات `customers`/`vendors` (93-113).
- `database/patch_invoices.sql` — `invoices.customer_id/vendor_id` (171-172)، `invoices_validate_parties()` (557-596).
- `database/patch_journal_dimensions.sql` — `party_type`/`party_id` (23-76)، `open_items_view` (~95-160).
- `database/patch_opening_entry.sql` — آلية القيد الافتتاحي.
- `database/patch_reverse_invoice_settlement.sql` — النسخة الفعّالة النهائية من `vouchers_validate_parties()` (16-59).
- `web/src/modules/settings/permissions/permission-catalog.ts` — مفاتيح `customers.*` (UI-only).
- `web/src/modules/settings/permissions/permission-utils.ts` — `canAccessRoute` (client-side فقط).
- `web/src/components/app-shell.tsx` — تطبيق `canAccessRoute` عبر إعادة توجيه بعد الرندر.
