# تدقيق عميق — قسم نقاط البيع (POS) وتوليد القيود عنها

منهجية هذا التدقيق: قراءة كود POS الفعلي (`database/patch_pos_points.sql` + الواجهة `web/src/modules/pos/` و`web/src/app/pos/`)، مع تتبّع أي صلاحية/دالة هي **الفعّالة فعلياً** بعد تطبيق كل الباتشات بترتيب `database/build_setup_all.ps1` (POS يُطبَّق عند `patch_pos_points.sql`، ثم يُعاد تعريف RLS الفواتير بعده في `patch_invoices_audit_fix.sql` — وهي مَن تحدد الصلاحيات الفعلية اليوم، تأكدت من ذلك بمطابقة `database/setup_all.sql` المُجمَّع). نقاط البيع لا تملك محرك ترحيل خاص بها — تُبنى بالكامل فوق محرك الفواتير العام (`saveInvoice` + `post_invoice`)، فأي ثغرة في صلاحيات الفواتير تنعكس مباشرة على POS.

---

## 1) حرج — صلاحية `pos.sell` وحدها لا تكفي لإتمام أي عملية بيع؛ شاشة البيع تتعطّل بالكامل لأي مستخدم لا يملك أيضاً صلاحيات الفواتير العامة

**المكان:**
- الواجهة: `web/src/modules/pos/components/pos-sell-screen.tsx:207-245` — زر "إتمام البيع" يستدعي `invoiceApi.saveInvoice(...)` ثم `invoiceApi.postInvoice(saved.id)` مباشرة، بدون أي مسار بديل.
- بوابات العرض فقط (لا فرض فعلي): `web/src/app/pos/sell/[pointId]/page.tsx:21` تكتفي بـ`hasPermission("pos.sell")` لعرض الشاشة.
- الفرض الفعلي في القاعدة (وهو ما يحكم فعلياً): `database/setup_all.sql:15545-15550` (`invoices_insert`)، `15578-15584` (`invoice_material_lines_insert`)، `15616-15622` (`invoice_account_lines_insert`)، وداخل دالة الترحيل: `database/setup_all.sql:15171-15176` (`assert_invoice_may_post`, النسخة الفعّالة الأخيرة من `patch_invoices_audit_fix.sql`).

**التتبع الدقيق:**
- `pos.sell` صلاحية مستقلة تماماً معرَّفة في `permission-catalog.ts:127` بعنوان "البيع من نقطة البيع" — منفصلة تصميمياً عن `invoices.*`، وواضح من الاسم أنها مقصودة لتكفي وحدها لدور "كاشير" لا يحتاج صلاحية الفواتير العامة.
- لكن السطر الأول من عملية البيع (`saveInvoice` → إدراج صف في `invoices`) يتطلب RLS `invoices_insert` التي تفحص **حصراً** `is_admin() or has_permission('invoices.create')` — لا وجود لـ`pos.sell` هنا إطلاقاً.
- أسطر المواد (`invoice_material_lines`) نفس الشيء: تتطلب `invoices.edit` أو `invoices.create`.
- حتى لو افترضنا نجاح الحفظ (بمنح `invoices.create` تحايلاً)، الخطوة الثانية `postInvoice()` تستدعي داخلياً `assert_invoice_may_post()` التي **ترفض صراحةً** أي طلب لا يملك `invoices.post` أو `invoices.edit`، وترمي رسالة خطأ صريحة: `'Permission denied: invoices.post (or invoices.edit) required to post.'`. لا فحص بديل لـ`pos.sell` هنا أيضاً.
- تأكدت أن `has_permission()` (`database/01_schema.sql:1084-1098`) مطابقة نصية بحتة على `permission_key` من جدول `user_permissions` — لا يوجد أي تدرّج/تضمين ضمني يجعل `pos.sell` يفعّل صلاحيات `invoices.*` تلقائياً.

**الأثر:** أي مستخدم يُمنح فعلياً `pos.view` + `pos.sell` فقط (وهو بالضبط الاستخدام الذي صُمّمت له هذه الصلاحية حسب تسميتها ووجودها المستقل بقائمة الصلاحيات، ومتاح لأي admin ينشئ صلاحيات مخصّصة per-user عبر `resolveEffectivePermissions` في `permission-utils.ts:8-26` التي تسمح بقائمة صلاحيات حرة تتجاوز الأدوار الجاهزة الثلاثة admin/accountant/viewer) سيرى شاشة البيع كاملة، يملأ السلة، يضغط "إتمام البيع" — وتفشل العملية بخطأ RLS/صلاحية من القاعدة (`new row violates row-level security policy for table invoices` أو رسالة `assert_invoice_may_post` الصريحة)، **في كل مرة، بدون استثناء**. الوسيلة الوحيدة لتشغيل POS فعلياً اليوم هي منح الكاشير أيضاً `invoices.create` + (`invoices.post` أو `invoices.edit`) — أي فتح كامل وحدة الفواتير العامة له (عرض/إنشاء/تعديل أي فاتورة بالنظام، ليس فقط البيع من نقطته)، وهو بالضبط ما يفترض أن وجود `pos.sell` كصلاحية منفصلة يمنعه.

**السلوك المطلوب:** إضافة `public.has_permission('pos.sell')` كبديل مقبول في الأماكن الثلاثة (`invoices_insert`, `invoice_material_lines_insert`, وداخل `assert_invoice_may_post`) — مع تقييد إضافي منطقي: قبول `pos.sell` فقط عندما `new.pos_point_id is not null` (أي الفاتورة فعلاً صادرة من نقطة بيع)، حتى لا تتحول `pos.sell` بدورها لصلاحية فواتير عامة بالخطأ.

---

## 2) عالي — أي مستخدم مسجَّل دخول (بلا `pos.settings`) يمكنه إنشاء/تعديل/حذف نقاط البيع وطرق الدفع مباشرة عبر REST، متجاوزاً صلاحية الإعدادات كلياً

**المكان:** `database/patch_pos_points.sql:140-163` (مطابقة لما هو مُطبَّق فعلياً بـ`database/setup_all.sql:14904-14927` — لا يوجد أي hotfix لاحق يقيّدها، بعكس الفواتير).

```sql
create policy pos_points_all_authenticated
  on public.pos_points for all to authenticated
  using (true) with check (true);
-- نفس الشيء لـ pos_point_payment_methods / pos_point_allowed_materials / pos_point_allowed_categories
```

**الأثر:** الواجهة تُخفي أزرار "تعريف النقاط"/"تعديل" خلف `hasPermission("pos.settings")` (`web/src/app/pos/points/page.tsx:15,57` و`pos/points/[id]/page.tsx:31`)، لكن هذا فرض واجهة فقط. أي مستخدم لديه أي صلاحية تسمح له بتسجيل الدخول (حتى `viewer` أو `pos.sell` فقط) يملك مفاتيح Supabase عبر `getSupabaseClient()` نفسها المستخدمة بالواجهة، فيستطيع مباشرة عبر PostgREST:
- تعديل `pos_points.default_creditor_account_id` / `default_debtor_account_id` لأي نقطة، فيحوّل مسار القيود المُولَّدة لاحقاً من كل عمليات تلك النقطة لحساب GL مختلف تماماً (تحويل إيراد مبيعات أو نقدية لحساب آخر).
- إضافة/حذف `pos_point_payment_methods` وربطها بأي حساب حسابات (`account_id`) — بما في ذلك حسابات لا علاقة لها بالصندوق.
- تغيير `branch_id`/`warehouse_id`/`invoice_pattern_id` للنقطة، مما يُخرج الفواتير اللاحقة من مستودع/فرع مختلف عمّا يتوقعه المستخدم.

هذا نفس نمط الثغرة الموثّق سابقاً بـ`AUDIT_PERIODS_AND_SECURITY.md` (`accounting_periods`/`branches` مفتوحتان لأي مستخدم) — يتكرر هنا بجدول POS بالكامل دون استثناء واحد.

**السلوك المطلوب:** تضييق سياسات RLS الأربعة إلى `using/with check (public.is_admin() or public.has_permission('pos.settings'))`، مع إبقاء `select` متاحاً بصلاحية أوسع (`pos.view`/`pos.sell`) لأن شاشة البيع تحتاج قراءة تفاصيل النقطة.

---

## 3) متوسط — أعلام تخصيص نقطة البيع (`allow_price_override`, `allow_line_discount`, `require_customer`, قوائم المواد/الفئات المسموحة) واجهة فقط، بلا أي تنفيذ خلفي

**المكان:**
- الأعمدة معرّفة بـ`database/patch_pos_points.sql:25-27` (`allow_price_override`, `allow_line_discount`, `require_customer`) وجداول `pos_point_allowed_materials`/`pos_point_allowed_categories` (سطر 110-120).
- الفرض الوحيد الموجود هو بالواجهة فقط:
  - `pos-sell-screen.tsx:393` — `disabled={!point.allow_price_override}` على حقل السعر.
  - `pos-sell-screen.tsx:238-240` — تصفير الخصم إن `!point.allow_line_discount` **بالواجهة فقط** قبل الإرسال.
  - `pos-sell-screen.tsx:185-188` — فحص `require_customer` بجافاسكربت قبل الاستدعاء.
  - `pos-sell-screen.tsx:66-93` — تصفية كتالوج المواد المعروض حسب `point.allowed_material_ids`/`allowed_category_ids` بمنطق JS بحت (`filterMaterialsForPattern`).
- بحثت في كل `database/*.sql` عن استخدام فعلي لهذه الأعمدة/الجداول خارج تعريفها — **لا يوجد أي trigger أو فحص داخل `post_invoice()`/`assert_invoice_may_post()`/أي محفز على `invoice_material_lines` يرجع لقيمة `pos_points.allow_price_override` أو `allow_line_discount` أو `require_customer` أو يتحقق من عضوية المادة بـ`pos_point_allowed_materials`**.

**الأثر:** أي طلب `saveInvoice` يُرسَل مباشرة (تجاوز الواجهة، أو عبر Devtools/طلب معدَّل) يستطيع:
- تسعير أي سطر بسعر مختلف تماماً عن سعر المادة حتى لو `allow_price_override = false` بالنقطة.
- إضافة خصم سطري حتى لو `allow_line_discount = false`.
- بيع مادة غير مدرجة أصلاً بقائمة `pos_point_allowed_materials`/`allowed_categories` للنقطة (طالما هي ضمن قيود نمط الفاتورة الأعمّ، والتي هي نفسها — حسب فحص مطابق — غير مُنفَّذة خلفياً أيضاً؛ `invoice_pattern_allowed_materials` بلا أي trigger فرض، فقط RLS إتاحة قراءة).
- إتمام بيع بدون عميل رغم `require_customer = true`.

هذا يطابق النمط المذكور مسبقاً بـ`AUDIT_INVOICE_PATTERNS.md` ("3 إعدادات معروضة للمستخدم بدون أي تنفيذ فعلي خلفها") — ويتكرر هنا بطبقة إضافية خاصة بـPOS فوق نفس الثغرة الموروثة من مستوى نمط الفاتورة.

**السلوك المطلوب:** نقل هذه الفحوص من الواجهة إلى محفز `before insert`/`before update` على `invoice_material_lines` (أو داخل `assert_invoice_may_post`/بداية `post_invoice`) يقرأ `pos_points` عبر `invoices.pos_point_id` ويرفض الإدراج إن خالف `allow_price_override`/`allow_line_discount`/عضوية المادة بالقوائم المسموحة، ويرفض `post_invoice` إن كانت الفاتورة من نقطة `require_customer=true` بلا `customer_id`.

---

## 4) منخفض — لا قفل/فحص تزامن على توفر المخزون عند البيع من POS (نفس ثغرة عامة موثّقة مسبقاً، وتتضخم هنا)

**المكان:** مسار `checkout()` نفسه بـ`pos-sell-screen.tsx:206-257` لا يفحص الرصيد المتاح قبل الإرسال، ومحرك `post_invoice` للمخزون لا يقفل الصف أثناء التحقق (نفس النمط الموثّق بـ`AUDIT_INVENTORY.md`).

**لماذا منخفض هنا تحديداً رغم توثيقه سابقاً كمتوسط:** شاشة POS بطبيعتها تتيح بيعاً متكرراً وسريعاً جداً من عدة نقاط/مستخدمين على نفس المستودع في نفس اللحظة (طابور كاشير)، فاحتمال تصادم بيع نفس الكمية الأخيرة من مادة من طرفين في نفس الثانية أعلى فعلياً من سند صرف يدوي عادي — يستحق أولوية أعلى ضمن معالجة الثغرة العامة عند تنفيذها، دون أن يكون خللاً إضافياً جديداً بحد ذاته.

---

## ملاحظات إيجابية من هذا التدقيق

- منطق توليد القيد نفسه لفاتورة البيع (`commercial_kind = 'sale'`) بـ`post_invoice()` سليم حسابياً: دائن حساب المبيعات بالإجمالي، مدين حساب الخصم عند وجوده، ومدين حساب التحصيل (نقدي أو ذمم حسب `settlement_mode`) بالصافي — لا تكرار ولا نقص بخلاف ما وُجد بجانب المشتريات (`AUDIT_INVOICES_JOURNAL.md` #1)، لأن شرط الخصم هنا (سطر 708 بـ`patch_invoice_pricing_cost.sql`) غير مرتبط بخلل `line_adjustments_affect_material_cost` الذي أثّر فقط على جانب الشراء.
- محفز `pos_points_validate()` (`patch_pos_points.sql:46-71`) يتحقق فعلياً من نقطتين مهمتين: أن المستودع تابع للفرع المختار، وأن نمط الفاتورة المرتبط `commercial_kind = 'sale'` — يمنع خطأ إعداد شائع (نقطة بيع تستخدم نمط شراء بالخطأ) عند التعريف.
- الفاتورة الناتجة من POS تمر بنفس محرك `post_invoice()` العام المُغلَّف بمعاملة واحدة ضمنية — أي فشل بمنتصف الترحيل يتراجع بالكامل، لا يوجد احتمال فاتورة POS نصف مرحّلة.

---

## أولوية التنفيذ المقترحة لهذا الملف

1. 🔴 إصلاح البند #1 فوراً — بدونه ميزة POS بالكامل غير قابلة للاستخدام بأي دور صلاحيات أضيق من "محاسب كامل الصلاحيات".
2. 🟠 تضييق RLS بند #2 — فجوة أمنية بيانات حقيقية (تحويل مسار القيود لحسابات مختلفة بلا صلاحية).
3. 🟡 بند #3 — فرض فعلي لأعلام التخصيص، خصوصاً `require_customer` و`allow_price_override` (أثر مالي مباشر إن استُغل).
4. 🔵 بند #4 — يُعالَج ضمن معالجة القفل العام لتوفر المخزون (`AUDIT_INVENTORY.md`) مع رفع أولوية نقاط البيع تحديداً.
