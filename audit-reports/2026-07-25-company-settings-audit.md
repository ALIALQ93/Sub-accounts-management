# تدقيق دقيق — إعدادات الشركة (Company Settings)

منهجية: `database/setup_all.sql` كمرجع نهائي مُجمَّع (آخر `create or replace`/سياسة تفوز حسب ترتيب `database/build_setup_all.ps1`)، مقروءاً مقابل `web/src/app/settings/company/page.tsx`، `web/src/modules/settings/services/settings-api.ts`، `web/src/modules/settings/types.ts`، `web/src/components/logo-upload-field.tsx`، `web/src/lib/supabase/storage.ts`، وجداول `company_settings` / `company_settlement_accounts` (`01_schema.sql` سطر 178-192، `patch_branches.sql` سطر 48-58، `06_storage.sql`).

---

## 1) 🔴 «العملة الأساسية للعرض» بشاشة إعدادات الشركة لا علاقة لها فعلياً بعملة الأساس المحاسبية الحقيقية — ولا قفل بعد الاستخدام لأنها أصلاً غير مفعّلة

**المكان:** `web/src/app/settings/company/page.tsx:252-271` (حقل `base_currency_id`، تسميته الحرفية "العملة الأساسية **للعرض**")، يُحفَظ عبر `settingsApi.updateCompanySettings` (`web/src/modules/settings/services/settings-api.ts:43-68`) إلى العمود `company_settings.base_currency_id` (`database/01_schema.sql:188`).

**المشكلة:** بحثت عن كل استخدام لـ`base_currency_id` بكامل المشروع — يظهر فقط بـ4 ملفات: `settings-api.ts`، `settings/types.ts`، شاشة الإعداد الأولي `setup/page.tsx` + `setup-api.ts`، وشاشة إعدادات الشركة نفسها. **لا يُقرأ إطلاقاً بأي دالة محاسبية** — لا بـ`to_base_amount()` (`01_schema.sql:364`)، ولا بأي مكان يحوّل بين العملات. عملة الأساس **الحقيقية** التي يعتمدها المحرك المحاسبي بالكامل هي عمود منفصل تماماً: `currencies.is_base = true` (`01_schema.sql:23-31`، تُضبَط عبر `currency_api.setBaseCurrency()` → `rpc('set_base_currency', ...)` بشاشة العملات المنفصلة).

بمعنى: يقدر المستخدم يختار بهذا الحقل عملة (مثلاً دولار) بينما تبقى `currencies.is_base` على الدينار (أو العكس) — بدون أي خطأ أو تحذير، وبدون أي أثر فعلي على القيود أو `debit_base`/`credit_base`. حتى معالج الإعداد الأولي (`setup-api.ts:118-120`, `saveCompany`) يحفظ هذا الحقل بنفس الطريقة المنفصلة تماماً عن `set_base_currency` — أي أن المستخدم يقدر يمر بكامل معالج الإعداد ويختار "دولار" كعملة أساس بالشاشة الأولى، والنظام بالخلفية يبقى شغّال فعلياً على الدينار (العملة المزروعة `is_base=true` بالبذرة الأولية، `01_schema.sql:2357`) بدون أي ربط بين الاثنين.

**بخصوص القفل بعد الاستخدام (مقارنة بـ`foundation_locked`):** لا يوجد أي عمود `locked_at`/`base_currency_locked` ولا أي محفز يمنع تغيير `company_settings.base_currency_id` بعد أول عملية ترحيل — لكن هذا يصبح ثانوياً أمام المشكلة الأعمق: الحقل أصلاً "زخرفي" بالكامل بمعنى مختلف عن FIFO بشاشة إعدادات الجرد (تلك الشاشة تُقرّ صراحة إنه غير منفَّذ — راجع `audit-reports/2026-07-25-inventory-settings-audit.md §1`)، بينما هذا الحقل يبدو وكأنه إعداد جوهري نشط (بدون أي تحذير مماثل) رغم انفصاله الكامل عن عملة الأساس الحقيقية.

**الأثر:** محاسب يفتح هذه الشاشة توقعاً إنها تتحكم بعملة الأساس للتقارير المالية والقيود — والفعلي إنها لا تفعل شيئاً بهذا الخصوص، وعملة الأساس الحقيقية تُدار من شاشة أخرى (العملات) بدالة مختلفة تماماً (`set_base_currency`). احتمال لبس عالٍ جداً لمحاسب غير مبرمج.

**السلوك المطلوب:** إما (أ) ربط هذا الحقل فعلياً بـ`set_base_currency` RPC بدل upsert مباشر على `company_settings`، أو (ب) إعادة تسميته بوضوح ("عملة العرض الافتراضية بالتقارير" مثلاً) مع توضيح صريح إنه لا يغيّر عملة الأساس المحاسبية، تماماً بنفس أسلوب تحذير FIFO بشاشة إعدادات الجرد.

---

## 2) 🟠 حقول "الحسابات الافتراضية" المطلوب تدقيقها غير قابلة للتعديل من أي شاشة إطلاقاً — بما فيها جدول مخصص لها بلا واجهة نهائياً

**المكان:** `database/patch_branches.sql:48-58` — جدول `company_settlement_accounts` (`default_inter_branch_account_id`, `default_inter_cc_account_id`) محمي بسياسات RLS كاملة وصحيحة (سطر 144-166: select للجميع، insert/update بشرط `is_admin() or has_permission('settings.company.edit')`)، لكن بحث شامل بكل `web/src` عن `settlement_accounts` أو `settlementAccount` **لم يُرجع أي نتيجة** — لا API، لا مكوّن، لا شاشة. الجدول موجود بقاعدة البيانات بالكامل (مع Trigger لـ`updated_at` وصف تعليقي "تُورَّث في السندات") لكن **لا توجد أي طريقة لتعبئته أو تعديله** غير SQL مباشر.

نفس الأمر لحقول الفروع الأكثر حساسية (`branches.default_cost_center_id`, `branches.inventory_account_id`, `branches.inter_branch_account_id`, `branches.default_warehouse_id` — `patch_branches.sql:15-22`): `BranchFormValues` (`web/src/modules/branches/services/branch-api.ts:41-49`) لا يتضمنها إطلاقاً، ونموذج الفرع `BranchFormModal` (`web/src/modules/branches/components/branch-form-modal.tsx:15-23`) لا يعرضها — رغم أنها الحقول التي وصفها تقرير الأمان السابق (`AUDIT_PERIODS_AND_SECURITY.md §3-ب`) بأنها "أكثر حساسية من جدول التسوية المجاور".

**الأثر:** "التحقق من صحة تعيين الحسابات الافتراضية" (المطلوب بهذا التدقيق) غير قابل للفحص عملياً — لأن لا وجود لواجهة تُعيّن هذه الحسابات أصلاً. أي منطق مقاصة CC/فرع بالسندات (`vouchers_before_update_handle_posting`, راجع `AUDIT_PERIODS_AND_SECURITY.md §1`) يعتمد ضمنياً على `inter_account_id` بجدول `voucher_netting_lines` الذي يبدو أنه يُملأ يدوياً بالسند نفسه، وليس عبر هذه الإعدادات الافتراضية المصمَّمة أصلاً لتسهيل هذا بالضبط.

**السلوك المطلوب:** إضافة واجهة فعلية (إما بشاشة إعدادات الشركة نفسها كقسم إضافي، أو بنموذج الفرع) لتعيين `company_settlement_accounts` وحسابات الفرع الافتراضية — أو، إن كانت الميزة مؤجَّلة عمداً، توثيق ذلك بوضوح بدل ترك جدول كامل يتيماً بلا أي إشارة بالواجهة.

---

## 3) 🟡 استبدال الشعار بامتداد ملف مختلف يترك نسخة يتيمة بالتخزين

**المكان:** `web/src/lib/supabase/storage.ts:84-105` (`uploadCompanyLogo`).

**المشكلة:** المسار ثابت على شكل `company/logo.${extension}` مع `upsert: true` (سطر 89-97). إن رفع المستخدم شعاراً بصيغة PNG أولاً (`company/logo.png`) ثم لاحقاً استبدله بصيغة JPG (`company/logo.jpg`)، فإن `upsert` يستبدل فقط ملفاً بنفس الاسم/الامتداد — الملف القديم (`logo.png`) **لا يُحذف** لأن لا استدعاء لـ`deleteCompanyLogoFromStorage` قبل الرفع الجديد بمسار مختلف (`logo-upload-field.tsx:27-42`، `onFileSelected` يستدعي `uploadCompanyLogo` مباشرة فقط). كل تبديل صيغة لاحق يراكم ملفاً يتيماً إضافياً بدلو `company-assets` (سقف 2 ميغابايت لكل ملف فقط، لكن التراكم مزعج لناحية النظافة).

**السلوك المطلوب:** قبل الرفع بامتداد جديد، حذف أي ملف `company/logo.*` سابق بامتداد مختلف (أو توحيد التخزين دائماً بامتداد واحد ثابت عبر تحويل الصورة، أو ببساطة استدعاء `deleteCompanyLogoFromStorage(currentLogoUrl)` قبل `uploadCompanyLogo` بمسار جديد إن اختلفت الصيغة).

---

## 4) ✓ نقاط إيجابية مؤكَّدة

- تحقق `!canEdit` مطبَّق بثبات على كل حقول النموذج (`disabled={!canEdit || isSaving}`)، مع رسالة توضيحية صريحة أعلى النموذج لغير المخوَّلين (`company/page.tsx:131-135`) — نمط أفضل من الشاشتين الأخريين بنفس مجموعة الإعدادات (راجع تقريري الفروع والفترات المحاسبية).
- التحقق من نوع/حجم الشعار مزدوج فعلياً: عميل (`storage.ts:45-52`) + سياسات bucket نفسها (`06_storage.sql:7-18`, `file_size_limit`/`allowed_mime_types`) — دفاع بعمق سليم.
- RLS لـ`company_settings` صحيحة ومقصودة: `select` مفتوح لـ`anon` أيضاً (استثناء موثَّق بوضوح بـ`patch_revoke_anon_table_access.sql:5,21` لغرض شعار/اسم شاشة الدخول)، بينما `insert`/`update` مقيَّدة بـ`is_admin() or has_permission('settings.company.edit')` (`02_rls.sql:177-192`) — لا إجراء مطلوب، هذا مطابق لما وثّقه `AUDIT_PERIODS_AND_SECURITY.md`.

---

## توصيات مرتّبة حسب الأولوية

### 🔴 عاجل
1. توضيح/ربط حقل "العملة الأساسية للعرض" بعملة الأساس المحاسبية الحقيقية (`currencies.is_base`) أو إعادة تسميته وتحذير المستخدم صراحة بانفصاله عنها (§1).

### 🟠 عالٍ
2. تفعيل واجهة فعلية لحسابات `company_settlement_accounts` والحسابات الافتراضية بالفرع (`inventory_account_id`, `inter_branch_account_id`, `default_cost_center_id`, `default_warehouse_id`) — أو توثيق تأجيلها بوضوح (§2).

### 🟡 متوسط
3. حذف نسخة الشعار القديمة عند الاستبدال بامتداد مختلف لتفادي تراكم ملفات يتيمة (§3).

## ملحق
- `web/src/app/settings/company/page.tsx`
- `web/src/modules/settings/services/settings-api.ts`, `web/src/modules/settings/types.ts`
- `web/src/components/logo-upload-field.tsx`, `web/src/lib/supabase/storage.ts`
- `web/src/modules/setup/services/setup-api.ts` (معالج الإعداد الأولي)
- `web/src/modules/currencies/services/currency-api.ts` (`setBaseCurrency` — عملة الأساس الحقيقية)
- `database/01_schema.sql` (`company_settings`, `currencies`, `to_base_amount`)
- `database/patch_branches.sql` (`company_settlement_accounts`)
- `database/06_storage.sql` (bucket `company-assets`)
- `database/patch_revoke_anon_table_access.sql` (استثناء anon الموثَّق)
