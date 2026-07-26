# تدقيق دقيق — شاشات سندات القبض والصرف (السندات الأساسية)

منهجية: قراءة الكود الفعلي (SQL + TypeScript) شاشة بشاشة، وليس مسحاً سطحياً. لأن دوال قاعدة البيانات الحرجة (`replace_voucher_lines`, `replace_voucher_allocations`, `sync_posted_voucher_journal`, `vouchers_before_update_handle_posting`) مُعرَّفة أكثر من مرة عبر عدة ملفات، اعتُمد `database/setup_all.sql` كمرجع الحقيقة المُجمَّع الفعلي — وهو الناتج المُركَّب من `database/build_setup_all.ps1` بترتيب: `01_schema.sql` ثم `02_rls.sql` ثم قائمة الـpatches بترتيبها في السكربت، حيث تفوز **آخر `create or replace function` تُطبَّق** لكل اسم دالة، وليس أول نتيجة بحث نصي. هذا التقرير يُكمل تقرير `2026-07-22-accounts-vouchers-audit.md` (الذي غطّى منطق الترحيل/RLS العام على مستوى السندات كلها) بالنزول مستوى أعمق داخل شاشات سند القبض وسند الصرف تحديداً — نماذجهما، قائمتهما، ومطابقة سلوك الواجهة (تعطيل/إخفاء الأزرار) مع ما تفرضه فعلياً القاعدة. لم تُكرَّر أي من نتائج التقرير السابق (حد التخصيص، RLS العامة على `vouchers`/`accounts`/`journal_entries`، حذف السند بلا فحص فترة، خلط العملات في التخصيص) — كل ما يلي جديد ومُتحقَّق من الكود الفعلي لشاشات `web/src/app/vouchers/payment/**`, `web/src/app/vouchers/receipt/**`, `web/src/modules/vouchers/components/{payment-voucher-form,receipt-voucher-form,payment-voucher-lines-table,receipt-voucher-lines-table,voucher-form,voucher-lines-table}.tsx`.

## 1. ميزة "تعديل السند المرحّل (مدير)" مُعطَّلة فعلياً في شاشتي القبض والصرف

الزر "حفظ التعديلات (مدير)" يظهر عندما `canEditPosted` (أي `isAdmin && status === 'posted'`، من `web/src/modules/vouchers/hooks/use-voucher-form-permissions.ts:13`) في `payment-voucher-form.tsx:836-849` و`receipt-voucher-form.tsx:838-850`، ويستدعي `saveVoucher("posted")`.

داخل `saveVoucher` (كلا الملفين، دالة واحدة بنفس البنية): بعد نجاح تحديث رأس السند (`voucherApi.updateVoucher`، سطر ~344)، يُستدعى **بلا شرط** `await syncVoucherLines(activeId);` (`payment-voucher-form.tsx:353`, `receipt-voucher-form.tsx:353`) والتي تستدعي بدورها `voucherApi.replaceVoucherLines` (`web/src/modules/vouchers/services/voucher-api.ts:1299-1330`) → RPC `replace_voucher_lines`.

لكن التعريف الفعّال لهذه الدالة (آخر مَن يُعيد تعريفها في ترتيب البناء هو `database/patch_voucher_atomic_ops.sql:29-31`، ولا يُعاد تعريفها بعده) يحتوي على:

```sql
if v_status = 'posted' then
  raise exception 'Cannot replace lines on posted voucher.';
end if;
```

**بلا أي استثناء لـ`is_admin()` أو أي علم تجاوز** — خلافاً لتريغر `vouchers_before_update_handle_posting` وخلافاً لـ`sync_posted_voucher_journal` (التعريف الفعّال في `database/patch_voucher_line_cc_optional.sql:21-36`) اللذين يفحصان `is_admin()` صراحة ويسمحان بالعملية للمدير. النتيجة: **كل محاولة حفظ من زر "حفظ التعديلات (مدير)" في سند قبض أو صرف مرحّل تفشل دائماً** برسالة خطأ من `replace_voucher_lines`، بغض النظر عن صلاحيات المستخدم — لأن الاستدعاء غير مشروط ولا يتحقق أصلاً مما إذا كانت الأسطر قد تغيّرت.

الأخطر: هذا يحدث **بعد** أن يكون تحديث رأس السند (`updateVoucher`) قد نجح فعلاً (التريغر يسمح للمدير بتحديث تاريخ/وصف/فرع السند المرحّل وحقول قيد اليومية المرتبط تلقائياً) — أي أن العملية **جزئية**: رأس السند وقيد اليومية (تاريخ/وصف) يتغيّران فعلاً في القاعدة، بينما يظهر للمستخدم خطأ عام (`showFromError`) يوحي بأن شيئاً لم يحدث. رسالة النجاح المُعدّة مسبقاً لهذه الحالة تحديداً — `getVoucherSaveFeedback`: `"تم حفظ التعديلات وتحديث قيد اليومية."` (`web/src/modules/vouchers/utils/voucher-save-utils.ts:29-31`) — لا تُعرض أبداً عملياً لأن الاستثناء يُرمى قبل الوصول إليها.

نفس الخلل ينسحب على وضع "إغلاق الحركات" (`isInvoiceMode`): بعد `syncVoucherLines` يُستدعى `syncVoucherAllocations` → RPC `replace_voucher_allocations` (نفس الملف `patch_voucher_atomic_ops.sql:100-102`) الذي يحمل نفس الحظر غير المشروط على `status = 'posted'`.

## 2. لا وسيلة للوصول إلى "عكس السند" (Reversal) من شاشتي القبض أو الصرف إطلاقاً

بحث شامل: `reverseVoucher` (`voucher-api.ts:1536`) لا يُستدعى من أي مكان في الكود **باستثناء** `web/src/modules/vouchers/components/voucher-form.tsx:379` (`onReverse`، مع `window.confirm` عند 362-388).

لكن `voucher-form.tsx` هو **كود ميت فعلياً** لسندات القبض والصرف: موجّه التحرير `voucher-edit-router.tsx:78-102` يوجّه `voucher_type === 'receipt'` إلى `ReceiptVoucherForm` و`voucher_type === 'payment'` إلى `PaymentVoucherForm` دائماً؛ الفرع الافتراضي الذي يعرض `VoucherForm` (سطر 114-121) لا يُصل إليه إلا إذا كان `voucherType` قيمة غير `receipt`/`payment`/`settlement`/فتح — وهو أمر مستحيل عملياً لأن عمود `vouchers.voucher_type` مقيّد بـ`check ... in ('receipt','payment','settlement')`. لا `PaymentVoucherForm` (`payment-voucher-form.tsx`) ولا `ReceiptVoucherForm` (`receipt-voucher-form.tsx`) ولا `VoucherListActions` (`voucher-list-actions.tsx`) يحتوي أي زر أو استدعاء لـ`reverseVoucher`.

**الأثر العملي**: تقرير `2026-07-22-accounts-vouchers-audit.md` وصف تأكيد العكس (`window.confirm` قبل `reverseVoucher`) بأنه "مُصلَح بالواجهة" — وهذا صحيح حرفياً للكود الموجود في `voucher-form.tsx`، لكن هذا الكود **غير قابل للوصول** من مستخدم حقيقي يعمل على سند قبض أو صرف. عملياً، لا توجد اليوم أي طريقة من واجهة التطبيق لعكس سند قبض/صرف مرحّل — الخياران المتاحان فقط هما: (أ) "حفظ التعديلات (مدير)" وهو مُعطَّل فعلياً (البند 1 أعلاه)، أو (ب) الحذف الفعلي (`delete_voucher_with_journal`) الموثَّق في التقرير السابق كحذف نهائي بلا أثر تدقيقي وبلا فحص فترة محاسبية. أي تصحيح لسند قبض/صرف مرحّل اليوم إما مستحيل من الواجهة، أو يتم عبر أخطر مسار متاح (الحذف الفعلي).

## 3. قفل "السند المرحّل" لا يحمي المرفقات إطلاقاً — لا في القاعدة ولا في التخزين

سياسات تخزين `voucher-attachments` (`database/06_storage.sql:103-137`، `insert`/`update`/`delete`) تفحص فقط:

```sql
bucket_id = 'voucher-attachments'
and (storage.foldername(name))[1] = 'vouchers'
and (public.is_admin() or public.has_permission('vouchers.edit'))
```

**لا فحص لحالة السند إطلاقاً.** أي مستخدم يملك صلاحية `vouchers.edit` العامة (وهي نفس الصلاحية المطلوبة لتعديل مسودة عادية — ليست `vouchers.post` ولا حصراً للمدير) يستطيع رفع أو حذف ملفات مرفقة لسند **مرحّل** مباشرة عبر Storage API، رغم أن الواجهة (`voucher-attachments-panel.tsx`, تُستدعى بـ`canManage={canSave && !readOnly}` في `payment-voucher-form.tsx:809-813`/`receipt-voucher-form.tsx:811-815`) تُخفي زر الرفع/الحذف لغير المدير عندما يكون السند مرحّلاً (`canSave` تعتمد على `canEditPosted` وهي حصراً للمدير). هذا تفاوت مباشر بين ما تفرضه الواجهة (زر مخفي لغير المدير) وما تسمح به القاعدة فعلياً (أي `vouchers.edit`) — تماماً نمط "الفجوة الشائعة" المطلوب فحصه.

يزيد الأمر تعقيداً أن جدول `voucher_attachments` نفسه (وليس التخزين) له سياسة RLS مفتوحة بالكامل `using(true)` بلا أي فحص صلاحية (موثَّق في التقرير السابق §3 عموماً لكل جداول السندات) — أي أن حتى مَن لا يملك `vouchers.edit` يستطيع إدراج **صف بيانات وصفية** (`file_name`, `storage_path`, `voucher_id`) في `voucher_attachments` يشير إلى أي مسار تخزين (حتى لو لم يستطع رفع الملف الفعلي بنفسه)، لعدم تطابق مستوى الحماية بين جدول القاعدة (مفتوح) وسياسة التخزين (تتطلب `vouchers.edit`).

## 4. الأسطر بمبلغ سالب أو صفري تُحذف بصمت دون رسالة تحقق مخصّصة

حقل المبلغ في `payment-voucher-lines-table.tsx:134-146` و`receipt-voucher-lines-table.tsx` المكافئ يستخدم `<input type="number" min={0} .../>` — و`min` على `type="number"` **لا يمنع** كتابة قيمة سالبة يدوياً (يؤثر فقط على أسهم الزيادة/النقصان)، فيمكن للمحاسب كتابة `-500` مباشرة في الحقل بلا أي رفض فوري.

عند الحفظ، الفلترة تتم بصمت: `validDebitLines`/`validCreditLines` في `payment-voucher-form.tsx:180-186`/`receipt-voucher-form.tsx:180-186` تستخدم شرط `Number(line.amount || 0) > 0` لتُسقط أي سطر بمبلغ صفري أو سالب دون تنبيه؛ نفس المنطق يتكرر في `buildPaymentVoucherLinesForSave` (`payment-voucher-lines-table.tsx:241-243`) و`buildReceiptVoucherLinesForSave` المكافئة. إن كانت كل الأسطر المُدخلة سالبة، لا تظهر رسالة "المبلغ يجب أن يكون موجباً" بل الرسالة العامة `"أضف سطراً مديناً واحداً على الأقل."` (`payment-voucher-form.tsx:270`) رغم أن المستخدم أضاف سطراً بالفعل — رسالة مضلِّلة لا تشرح أن القيمة السالبة هي السبب.

## 5. قائمة السندات: لا ترقيم صفحات ولا بحث نصي/بتاريخ — تحميل كل السجلات دفعة واحدة

`voucherApi.listVouchers()` (`web/src/modules/vouchers/services/voucher-api.ts:261-269`) يجلب **كل** صفوف `vouchers` بلا `.range()`/`.limit()`، مع `select` متداخل يضم `voucher_lines(amount, side, amount_base)` لكل سند (لحساب الإجمالي في العميل، أسطر 297-306) و`voucher_attachments(count)`. صفحة `web/src/app/vouchers/page.tsx` لا تعرض سوى أزرار تصفية حسب النوع (الكل/قبض/دفع/تصفية/إغلاق حركات، أسطر 132-155) — **لا يوجد حقل بحث نصي، ولا فلتر تاريخ (من–إلى)، ولا فلتر حالة (مسودة/معتمد/مرحّل/ملغي)، ولا فلتر عميل/مورد**. مع تراكم السندات بمرور الوقت في تطبيق محاسبي فعلي، هذا يعني تحميلاً متزايد الحجم لكل الصفحة عند كل فتح، ولا وسيلة لمستخدم واحد (محاسب حالياً بلا مساعدين) لتصفية سندات شهر أو عميل معيّن بسرعة.

## 6. عدم اتساق مع نظام التصميم المشترك (Badge/Modal)

- `StatusChip` (`web/src/modules/vouchers/components/status-chip.tsx:10-15`) يُعرِّف ألوانه الخاصة (`bg-slate-100 text-slate-700`, `bg-amber-100 text-amber-800`, `bg-emerald-100 text-emerald-800`, `bg-rose-100 text-rose-800`) بدل استخدام الفئات المشتركة `.badge`/`.badge-success`/`.badge-muted`/`.badge-info` المبنية على `var(--success)`/`var(--info)` (`web/src/app/globals.css:178-199`). ملاحظة إضافية: `globals.css` نفسه لا يملك بعد `.badge-danger`/`.badge-warning` جاهزتين — وهذا على الأرجح سبب لجوء `StatusChip` لتلوين يدوي بدل التوسّع في نظام الـbadge القائم.
- تأكيدات الحذف/التغيير الحرجة في وحدة السندات كلها تعتمد على `window.confirm()` الأصلي للمتصفح بدل مكوّن `Modal` المشترك (`web/src/components/modal.tsx`، المُستخدم في 10 مواضع أخرى بالتطبيق): حذف سند من القائمة (`voucher-list-actions.tsx:67`)، حذف مرفق (`voucher-attachments-panel.tsx:95`)، وحتى تأكيد العكس في الكود الميت (`voucher-form.tsx:366`). `window.confirm` لا يدعم تنسيق RTL المتّسق مع بقية الواجهة، ولا يمكنه عرض محتوى غني (كإظهار تفاصيل السند/المبلغ قبل عملية حذف نهائي بلا رجعة)، ويُغلَق أحياناً تلقائياً بمانعات النوافذ المنبثقة في بعض المتصفحات.

## 7. لا وعي بالفترة المحاسبية داخل شاشة السند نفسها

بحث شامل في `web/src/modules/vouchers` و`web/src/app/vouchers`: لا وجود لأي إشارة إلى `accounting_period`/الفترة المحاسبية/`period_open` في شاشتي القبض والصرف. حقل التاريخ (`voucherDate`، يبدأ بـ`new Date().toISOString().split("T")[0]` وهو تاريخ المتصفح المحلي) غير مقيَّد بأي فحص للفترة المفتوحة أثناء التعبئة أو الحفظ كمسودة/اعتماد — الفحص الوحيد (`assert_accounting_period_open`) يقع فقط داخل تريغر الترحيل النهائي (`vouchers_before_update_handle_posting`). عملياً: يمكن للمحاسب تعبئة سند قبض/صرف كاملاً (أسطر، تخصيصات، مرفقات) بتاريخ يقع في فترة مغلقة، ولن يكتشف ذلك إلا عند الضغط على "ترحيل" في نهاية العملية، عبر رسالة استثناء عامة من القاعدة بلا أي تلميح مسبق في الشاشة نفسها.

## 8. لا إمكانية طباعة أو تصدير لسند القبض/الصرف

بحث شامل عن `print`/`export`/طباعة/تصدير ضمن `web/src/app/vouchers/**`: لا نتائج فعلية (التطابقات الوحيدة كانت `export default function` في تعريفات الصفحات). لا زر طباعة على شاشة السند المفرد، ولا تصدير CSV/PDF من قائمة السندات. لتطبيق محاسبي يخدم محاسباً يحتاج غالباً نسخة ورقية/PDF من سند القبض أو الصرف للأرشفة أو تسليمها للعميل/المورد، هذه فجوة عملية ملموسة.

## 9. تهيئة `allowedSettlementModes` غير متّسقة مع واقع القبض/الصرف (بلا أثر عملي حالياً)

`VOUCHER_TYPE_CONFIG.receipt.allowedSettlementModes` و`.payment.allowedSettlementModes` في `web/src/modules/vouchers/utils/voucher-type-config.ts:30,40` كلاهما `["account"]` فقط — رغم أن سندات القبض/الصرف تدعم فعلياً `settlement_mode = 'invoice'` عبر شاشتي "إغلاق الحركات" المنفصلتين. هذا التكوين لا يؤثر حالياً لأنه يُستهلك حصراً من `voucher-form.tsx` الميت (البند 2)؛ لكنه دليل إضافي على أن ذلك الملف لم يعد متزامناً مع التصميم الفعلي للتطبيق، ويجب إما حذفه أو تحديثه إن أُعيد استخدامه مستقبلاً (مثلاً كمسار احتياطي لأنواع سندات جديدة).

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **إصلاح `replace_voucher_lines`/`replace_voucher_allocations` للسماح بالاستبدال عند `status='posted'` إذا كان المستدعي `is_admin()`** (تماشياً مع `sync_posted_voucher_journal` و`vouchers_before_update_handle_posting`) — حالياً ميزة "تعديل السند المرحّل (مدير)" مُعطَّلة بالكامل في شاشتي القبض والصرف وتُنتج كتابة جزئية (رأس السند يتغيّر، الأسطر لا). بديل أسرع: لو التصميم المقصود فعلاً هو منع تعديل الأسطر حتى للمدير (تعديل الرأس فقط)، عدّل `saveVoucher` في الواجهتين ليتخطى `syncVoucherLines`/`syncVoucherAllocations` تماماً عند `canEditPosted`، بدل استدعائهما دائماً والفشل.
2. **إتاحة "عكس السند" فعلياً من شاشتي سند القبض وسند الصرف** — أضف زر عكس (مع نفس تأكيد `window.confirm`/أو الأفضل `Modal`) إلى `payment-voucher-form.tsx` و`receipt-voucher-form.tsx` (أو إلى `voucher-list-actions.tsx` كإجراء على القائمة)، يستدعي `voucherApi.reverseVoucher`. حالياً لا مسار آمن لتصحيح سند مرحّل من الواجهة على الإطلاق لهذين النوعين — فقط الحذف الفعلي الخطر الموثَّق سابقاً.

### 🟠 عالٍ

3. **إضافة فحص حالة السند إلى سياسات تخزين `voucher-attachments`** (`database/06_storage.sql:103-137`) — أضف شرطاً يمنع `insert`/`update`/`delete` عندما يكون السند المرتبط `status='posted'` إلا لـ`is_admin()`، ليطابق فعلياً ما تُخفيه الواجهة عن غير المدير.
4. **رسالة تحقق مخصّصة عند إدخال مبلغ سالب/صفري** بدل الإسقاط الصامت — تحقق صريح في `payment-voucher-form.tsx`/`receipt-voucher-form.tsx` قبل الفلترة يرفض القيم ≤ 0 برسالة واضحة ("المبلغ يجب أن يكون أكبر من صفر")، وأضف `pattern`/`onKeyDown` أو تحقق JS يمنع كتابة الإشارة السالبة أصلاً في حقل `type="number"`.

### 🟡 متوسط

5. **إضافة ترقيم صفحات وبحث/فلترة إلى `/vouchers`** — فلتر تاريخ (من–إلى)، فلتر حالة، وربما بحث نصي برقم السند/الوصف، مع `.range()` على `voucherApi.listVouchers()` بدل تحميل كل السجلات دفعة واحدة.
6. **توحيد `StatusChip` مع نظام الـbadge المشترك** (`.badge-success`/`.badge-muted` + إضافة `.badge-danger`/`.badge-warning` إلى `globals.css`)، **واستبدال `window.confirm()` بمكوّن `Modal` المشترك** في تأكيدات حذف السند/المرفق، تماشياً مع بقية التطبيق.
7. **إظهار حالة الفترة المحاسبية داخل شاشة السند** (تنبيه إن كان `voucherDate` المختار يقع في فترة مغلقة) بدل ترك الاكتشاف لحظة الترحيل فقط.

### 🔵 توصية معمارية

8. **إضافة طباعة/تصدير لسند القبض والصرف** (عرض قابل للطباعة على الأقل عبر `window.print()` بتنسيق مخصّص، أو تصدير PDF/CSV من القائمة).
9. **حذف `voucher-form.tsx` كمسار تحرير عام للسندات (كود ميت لأنواع `receipt`/`payment`)، أو توثيقه صراحة كمسار احتياطي فقط** — وتحديث `VOUCHER_TYPE_CONFIG.receipt/payment.allowedSettlementModes` ليشمل `"invoice"` إن قُرِّر إبقاؤه.

## ملحق — ملفات مرجعية رئيسية

- `web/src/modules/vouchers/components/payment-voucher-form.tsx` — `saveVoucher` (254-392)، `syncVoucherLines` (227-244)، زر "حفظ التعديلات (مدير)" (836-849)، `validDebitLines` (180-186).
- `web/src/modules/vouchers/components/receipt-voucher-form.tsx` — البنية المطابقة (254-392، 227-244، 838-850، 180-186).
- `web/src/modules/vouchers/components/payment-voucher-lines-table.tsx` — `buildPaymentVoucherLinesForSave` (237-274)، حقل المبلغ (134-146).
- `web/src/modules/vouchers/components/voucher-form.tsx` — كود العكس غير القابل للوصول لسندات القبض/الصرف (362-388)، `useEffect` فرض `allowedSettlementModes` (397-401).
- `web/src/modules/vouchers/components/voucher-edit-router.tsx` — منطق التوجيه حسب `voucher_type` (78-121).
- `web/src/modules/vouchers/components/voucher-list-actions.tsx` — إجراءات القائمة، `window.confirm` (67).
- `web/src/modules/vouchers/components/voucher-attachments-panel.tsx` — رفع/حذف المرفقات، `window.confirm` (95).
- `web/src/modules/vouchers/components/status-chip.tsx` — ألوان الحالة المخصّصة (10-15).
- `web/src/modules/vouchers/hooks/use-voucher-form-permissions.ts` — `canEditPosted`/`formReadOnly`/`canSave` (13-50).
- `web/src/modules/vouchers/services/voucher-api.ts` — `listVouchers` (261-324، بلا ترقيم صفحات)، `updateVoucher` (1227-1246)، `replaceVoucherLines` (1299-1330)، `replaceVoucherAllocations` (1383-1415)، `replaceVoucherNettingLines` (1431-1468)، `syncPostedVoucherJournal` (1528-1534)، `reverseVoucher` (1536+).
- `web/src/modules/vouchers/utils/voucher-type-config.ts` — `allowedSettlementModes` (30, 40).
- `database/patch_voucher_atomic_ops.sql` — التعريف الفعّال لـ`replace_voucher_lines` (7-74، الحظر عند 29-31) و`replace_voucher_allocations` (76-134، الحظر عند 100-102).
- `database/patch_voucher_line_cc_optional.sql` — التعريف الفعّال لـ`sync_posted_voucher_journal` (21-157، فحص `is_admin()` عند 34-36).
- `database/setup_all.sql:9865` — التعريف الفعّال النهائي لـ`vouchers_before_update_handle_posting` (من `patch_reverse_invoice_settlement.sql`).
- `database/06_storage.sql` — سياسات تخزين `voucher-attachments` (89-137، بلا فحص حالة السند).
- `web/src/app/globals.css` — `.btn`/`.btn-outline` (123-176)، `.badge*` (178-199)، متغيرات `--success`/`--danger`/`--warning` (22-24).
- `web/src/components/modal.tsx` — المكوّن المشترك غير المُستخدَم في وحدة السندات.
