# تدقيق دقيق — الفترات المحاسبية (Accounting Periods)

منهجية: `database/setup_all.sql` كمرجع نهائي مُجمَّع (آخر `create or replace`/سياسة تفوز حسب ترتيب `database/build_setup_all.ps1`)، مقروءاً مقابل `web/src/app/settings/accounting-periods/page.tsx`، `web/src/modules/accounting-periods/services/accounting-period-api.ts`، `web/src/modules/accounting-periods/components/accounting-period-form-modal.tsx`، وتتبّع كل نقاط استدعاء `assert_accounting_period_open()` عبر كامل `database/*.sql` (وليس فقط الافتراض بأنها مطبَّقة). هذا التقرير يبني على `AUDIT_PERIODS_AND_SECURITY.md` (الذي أثبت أن RLS أصبحت مقيَّدة بصلاحية إدارية وأن دالة الترحيل موحّدة سليمة) — لا أعيد فحص تلك النقاط، بل أذهب لمستوى الشاشة نفسها وسلامة منطق الفترات كبيانات.

---

## 1) 🟠 لا كشف تداخل تواريخ (Overlap) بين الفترات إطلاقاً — لا بالواجهة ولا بقاعدة البيانات

**المكان:** `database/patch_accounting_periods.sql:7-24` — القيود الوحيدة على الجدول: `check (end_date >= start_date)` (سطر 20) وفهرس فريد على `(period_code, coalesce(branch_id, ...))` (سطر 23-24، يمنع فقط تكرار **نفس الرمز** لنفس الفرع). الواجهة (`web/src/app/settings/accounting-periods/page.tsx:65-77`, `onSubmit`) تتحقق فقط من: الحقول المطلوبة، ووجود التواريخ، و`end_date >= start_date`. **لا فحص أي تداخل مع فترة موجودة أصلاً** — لا بنفس الفرع ولا على مستوى الشركة ككل، رغم أن قائمة الفترات الكاملة (`periods` state) محمَّلة فعلاً بالذاكرة بنفس الشاشة (`page.tsx:16,25-29`) ويمكن الفحص عليها محلياً بسهولة قبل الإرسال.

**الأثر:** يمكن إنشاء فترتين برمزين مختلفين تغطيان نفس المدى الزمني (أو متداخلتين جزئياً) لنفس الفرع أو للشركة ككل — وأخطر من ذلك: **بحالتين متناقضتين** (مثلاً فترة سنوية 2026 "مقفلة" بينما فترة ربع أول 2026 "مفتوحة" تتقاطع معها بالكامل). دالة `assert_accounting_period_open` (راجع البند 3) ستمنع الترحيل بأي حال لأنها تبحث عن **أي** فترة مغلقة مطابقة (بصرف النظر عن الفترة الأخرى المفتوحة المتداخلة)، فالسلوك الفعلي "آمن" بمعنى منع الترحيل، لكن التقارير المرتبطة بفترة (تقارير حسب `fiscal_year`/الفترة) تصبح مبهمة: أي فترة تُنسَب لها الحركة عند العرض إن كانت التواريخ متداخلة بين فترتين مختلفتين؟

**السلوك المطلوب:** فحص تداخل صريح بالواجهة قبل الحفظ (بمقارنة `start_date`/`end_date` الجديدين مع كل الفترات المحمَّلة لنفس `branch_id` أو `null`)، مع رسالة توضيحية بالفترة المتعارضة تحديداً.

---

## 2) 🟠 لا حماية أو توضيح لعملية "إعادة فتح" فترة مقفلة — نفس وزن أي حقل تجميلي آخر بالنموذج

**المكان:** `web/src/modules/accounting-periods/components/accounting-period-form-modal.tsx:118-133` — حقل الحالة مجرد `<select>` عادي بخيارين ("مفتوحة"/"مقفلة")، بنفس مستوى الأهمية البصرية والتفاعلية لحقل "الاسم" أو "السنة المالية" بنفس النموذج. لا يوجد أي:
- تأكيد إضافي (confirm/نافذة منفصلة) عند التبديل من "مقفلة" إلى "مفتوحة" تحديداً.
- توضيح للأثر الفوري: إعادة الفتح تُلغي فوراً كل حماية `assert_accounting_period_open` (`database/patch_period_enforcement.sql:7-42`) لأي تاريخ ضمن مدى هذه الفترة، بكل السندات والفواتير وتسويات المخزون بالنظام (أو بالفرع المحدَّد) — بدون أي مرحلة وسيطة أو صلاحية أعلى من `settings.company.edit` العادية.
- أي أثر تدقيقي (audit trail) لمن قام بإعادة الفتح ومتى ولماذا — فقط `updated_at` عام (`accounting_periods_set_updated_at()`, `patch_accounting_periods.sql:71-84`) بلا عمود `closed_by`/`reopened_by`/`reopen_reason`.

**السلوك المطلوب:** فصل تغيير الحالة عن نموذج التعديل العام إلى إجراء مستقل ("إقفال الفترة" / "إعادة فتح الفترة") بتأكيد صريح يعرض نطاق التاريخ والفرع المتأثر، مع تسجيل من قام بالإجراء كحد أدنى.

---

## 3) ✓ تحقق إيجابي — إنفاذ إغلاق الفترة موصول فعلياً بكل مسارات الترحيل الرئيسية (تتبّع كامل)

بحثت عن كل نقطة استدعاء لـ`assert_accounting_period_open` بكامل `database/*.sql` (وليس فقط بالملف الذي عرّفها) — الدالة مستدعاة فعلياً من:
- ترحيل السندات: `vouchers_before_update_handle_posting()` — آخر نسخة فعّالة بـ`patch_reverse_invoice_settlement.sql:114` (يطابق ما وثّقه `AUDIT_PERIODS_AND_SECURITY.md §1`).
- ترحيل الفواتير: `patch_post_invoice.sql:153`.
- تسويات الأسطر والتصنيع: `patch_invoice_line_adjustments.sql:205`, `patch_invoice_manufacturing.sql:570`, `patch_invoice_pricing_cost.sql:588`, `patch_composite_disassembly.sql:1120`.
- تسويات المخزون المباشرة: `patch_inventory_phase2.sql:56`, `patch_inventory_phase3.sql:202,205` (بفحصين — عام وبالفرع تحديداً)، `patch_inventory_reports.sql:250`.

هذا تغطية واسعة وحقيقية عبر كل مسارات الترحيل التي تملك واجهة فعلية بالنظام — **لا إجراء مطلوب على هذه النقطة**، وتؤكد استنتاج `AUDIT_PERIODS_AND_SECURITY.md §1` بأن منطق الإنفاذ سليم فعلياً رغم التشتت الظاهري بين الملفات.

## 3-ب) 🟠 لكن الإنفاذ يعيش فقط بطبقة الدوال/المحفزات على مصادر الترحيل — وليس بجدول القيود النهائي نفسه

**المكان:** `database/02_rls.sql:73-80` (تنطبق حرفياً على `setup_all.sql:2754-2762` أيضاً — لم تُستبدل بأي ملف لاحق):

```sql
create policy "journal_entries_insert_all" on public.journal_entries
  for insert to authenticated with check (true);
...
create policy "journal_entries_update_all" on public.journal_entries
  for update to authenticated using (true) with check (true);
```

**المشكلة:** كل فحوصات الفترة المحاسبية (البند 3 أعلاه) تحدث **قبل** إدراج/تحديث `journal_entries` — أي أنها تعيش بمنطق التطبيق (RPC/محفزات على `vouchers`/`invoices`/دوال المخزون)، وليست بمحفز مباشر على `journal_entries` نفسه. جدول `journal_entries` (مصدر الحقيقة النهائي لكل تقرير مالي) قابل للإدراج والتعديل من **أي مستخدم مسجّل دخول** (`to authenticated using(true) with check(true)`, بلا شرط `is_admin()` ولا `assert_accounting_period_open`) — بحثت بكامل `web/src` عن أي إدراج مباشر على `journal_entries` من الواجهة (`.from("journal_entries").insert`) ولم أجد أي نتيجة، فالثغرة **غير قابلة للاستغلال عبر الواجهة المشحونة حالياً** — لكنها بمسافة استدعاء REST/Supabase مباشر واحدة فقط من تجاوز إقفال الفترة بالكامل (تعديل `entry_date` لقيد موجود ليقع ضمن فترة مقفلة، أو إدراج قيد جديد مباشرة بتاريخ مقفل)، دون أي حارس بالطبقة الأدنى.

**السلوك المطلوب:** إضافة محفز `before insert or update of entry_date on journal_entries` يستدعي `assert_accounting_period_open(entry_date, branch_id)` كطبقة حماية أخيرة (defense-in-depth) — بصرف النظر عن مسار الإدخال (سند، فاتورة، أو أي مسار مستقبلي).

---

## 4) 🟡 `fiscal_year` حقل مُدخَل يدوياً منفصل تماماً عن `start_date`/`end_date` بلا أي تحقق تطابق

**المكان:** `web/src/modules/accounting-periods/components/accounting-period-form-modal.tsx:104-117` — حقل رقمي حر بلا أي ربط بمنطق حساب السنة من التواريخ الفعلية. `web/src/app/settings/accounting-periods/page.tsx:65-77` (`onSubmit`) لا يتحقق من تطابقه مع `start_date`.

**المشكلة:** يمكن حفظ فترة بـ`start_date`/`end_date` بسنة 2027 و`fiscal_year = 2026` (أو أي رقم آخر بين 1900-9999 حسب قيد `01_schema` — لا حتى تحقق منطقي بسيط كـ"ضمن نطاق السنة الحالية ±N"). بما أن `fiscal_year` يُستخدم كعمود فرز أساسي بقائمة الفترات (`accounting-period-api.ts:101`) ومن المرجَّح استخدامه بتقارير أخرى مبنية على الفترات، فهذا مصدر بيانات غير متسقة صامت.

**السلوك المطلوب:** اشتقاق `fiscal_year` تلقائياً من `start_date` بالواجهة (مع إمكانية تعديل يدوي استثنائي)، أو تحذير عند عدم التطابق.

---

## 5) 🟡 نفس علة اختيار الفرع الصامتة عند تعديل فترة مرتبطة بفرع أصبح معطَّلاً

**المكان:** `web/src/modules/accounting-periods/components/accounting-period-form-modal.tsx:62-64` (`branchApi.listBranchOptions().then(data => setBranches(data.filter(b => b.is_active)))`) مقابل `164-180` (قائمة اختيار الفرع). تفصيل كامل للعلة موثَّق بـ`audit-reports/2026-07-25-branches-audit.md §3` — نفس النمط بالضبط: تعديل أي فترة مرتبطة بفرع مُعطَّل لاحقاً يُسقط الفرع من الخيارات المعروضة بصمت.

---

## 6) 🔵 عدم اتساق واجهة — نفس نمط شاشة الفروع (لا `Modal` مشترك، لا أزرار `.btn`، لا رسالة "عرض فقط")

**المكان:** `web/src/modules/accounting-periods/components/accounting-period-form-modal.tsx:69-71` (`<div className="fixed inset-0 z-50 ...">` يدوي) و`199-216` (أزرار `bg-blue-900`/Tailwind خام بدل `.btn-primary`/`.btn-outline`)، بينما شاشة القائمة نفسها (`accounting-periods/page.tsx:107,162`) تستخدم `.btn`/`.btn-primary`/`.btn-outline` بشكل صحيح للأزرار خارج النموذج فقط. نفس غياب رسالة "عرض فقط" لمستخدم بلا صلاحية (قارن `web/src/app/settings/company/page.tsx:131-135`) — هنا فقط عمود "إجراء" يعرض "—" بصمت.

---

## توصيات مرتّبة حسب الأولوية

### 🟠 عالٍ
1. إضافة كشف تداخل تواريخ صريح بالواجهة قبل حفظ أي فترة جديدة أو معدَّلة (§1).
2. فصل تبديل حالة الفترة (إقفال/إعادة فتح) لإجراء مستقل بتأكيد صريح وأثر تدقيقي — لا يُعامَل كأي حقل نموذج عادي (§2).
3. إضافة محفز `assert_accounting_period_open` مباشرة على `journal_entries` كطبقة حماية أخيرة مستقلة عن مسار الترحيل (§3-ب).

### 🟡 متوسط
4. ربط/تحقق `fiscal_year` بـ`start_date` تلقائياً بدل حقل مستقل تماماً (§4).
5. إصلاح إسقاط اختيار الفرع الصامت عند تعديل فترة مرتبطة بفرع معطَّل (§5، تفصيل كامل بتقرير الفروع).

### 🔵 منخفض / تحسين اتساق
6. استخدام مكوّن `Modal` المشترك وأزرار `.btn` بنموذج الفترة، وإضافة رسالة "عرض فقط" لمستخدم بلا صلاحية (§6).

## ملحق
- `web/src/app/settings/accounting-periods/page.tsx`
- `web/src/modules/accounting-periods/services/accounting-period-api.ts`, `web/src/modules/accounting-periods/components/accounting-period-form-modal.tsx`
- `database/patch_accounting_periods.sql`, `database/patch_period_enforcement.sql`
- نقاط استدعاء الإنفاذ: `patch_post_invoice.sql`, `patch_invoice_line_adjustments.sql`, `patch_invoice_manufacturing.sql`, `patch_invoice_pricing_cost.sql`, `patch_composite_disassembly.sql`, `patch_inventory_phase2.sql`, `patch_inventory_phase3.sql`, `patch_inventory_reports.sql`, `patch_reverse_invoice_settlement.sql`
- `database/02_rls.sql` (سياسات `journal_entries`)
- مرجع سابق: `AUDIT_PERIODS_AND_SECURITY.md` (RLS وإنفاذ الترحيل — لم يُعَد فحصه هنا)
- مرجع الفروع: `audit-reports/2026-07-25-branches-audit.md`
