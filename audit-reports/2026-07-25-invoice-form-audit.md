# تدقيق دقيق — نموذج الفاتورة الرئيسي والقائمة

منهجية: قراءة الكود الفعلي (TypeScript React + استدعاءات RPC/Supabase المرتبطة بها) شاشة بشاشة، وليس مسحاً سطحياً، مع تتبّع كل مسار «UI action → API call → RLS/trigger» حتى نهايته الفعلية بدل الاكتفاء بقراءة الكود بمعزل عن بعضه. لأن دوال قاعدة البيانات الحرجة (`post_invoice`, `cancel_draft_invoice`, `invoices_before_update_guard`, `invoice_lines_prevent_change_when_posted`) مُعرَّفة أكثر من مرة عبر عدة ملفات `patch_*.sql`، اعتُمد `database/setup_all.sql` — الناتج المُركَّب فعلياً من `database/build_setup_all.ps1` بترتيب `01_schema.sql` ثم `02_rls.sql` ثم قائمة الباتشات — كمرجع الحقيقة؛ حيث تفوز آخر `create or replace function` تُطبَّق لكل اسم دالة، وليس أول نتيجة بحث نصي. هذا التقرير مكمّل لتقرير `2026-07-23-invoices-audit.md` (الذي غطّى قسم الفواتير ككل من زاوية الأنماط، الصلاحيات، RLS، والتسعير على مستوى SQL) — لم يُكرَّر أي من نتائجه، وحيث تقاطع التحقق الحالي مع فجوة سابقة (كإلغاء الفاتورة) جرى التحقق من **حالتها الفعلية اليوم** بدل افتراضها. النطاق هنا محصور بنموذج الفاتورة الرئيسي وقائمتها فقط: `web/src/app/invoices/{page,new,[id]}.tsx`، `web/src/modules/invoices/components/invoice-form.tsx` (2084 سطراً)، `invoice-material-lines-table.tsx` (1111 سطراً)، `invoice-account-lines-table.tsx`، `reference-lines-picker.tsx`، `invoice-status-chip.tsx`، `invoices-list-table.tsx`، وخدماتها المباشرة (`invoice-api.ts`, `reference-invoice-api.ts`, `validate-invoice.ts`).

## 1. زر «ترحيل» يُرحّل بيانات قديمة من القاعدة، لا التعديلات الحالية على الشاشة — أخطر ثغرة بالنموذج

`onPost` (`invoice-form.tsx:1237-1261`):

```ts
const onPost = async () => {
  if (!savedId) {
    await onSave(true);
    return;
  }
  const validationError = await runValidation(true);
  if (validationError) { setError(validationError); return; }
  ...
  const journalId = await invoiceApi.postInvoice(savedId);
```

عندما يكون `savedId` موجوداً بالفعل (وهو الحال دائماً عند فتح فاتورة موجودة للتعديل — `mode="edit"` يهيّئ `savedId` من `invoiceId` فوراً عبر `useState(invoiceId ?? "")`، `invoice-form.tsx:207`)، فإن `onPost` **لا يستدعي `onSave` إطلاقاً**. هو يستدعي `runValidation(true)` (`invoice-form.tsx:1001-1155`) الذي يتحقق فقط من **حالة الذاكرة الحالية** (`materialLines`, `accountLines`, حقول الرأس بالـ`useState`)، ثم يستدعي مباشرة `invoiceApi.postInvoice(savedId)` (`invoice-api.ts:394-414`) الذي ينفّذ RPC `post_invoice(p_invoice_id)` — وهذه الدالة تقرأ وترحّل **ما هو مخزَّن فعلياً بجداول `invoices`/`invoice_material_lines`/`invoice_account_lines`**، أي آخر ما حُفظ عبر `onSave`، وليس ما هو معروض حالياً بالشاشة.

المسار الوحيد الذي يحفظ فعلياً هو `onSave` (`invoice-form.tsx:1157-1235`)، عبر `invoiceApi.saveInvoice` (`invoice-form.tsx:1169`، `invoice-api.ts:283-316`). زر «حفظ مسودة» (`invoice-form.tsx:2012-2019`) يستدعي `onSave(false)`، وهو **زر منفصل تماماً** عن زر «ترحيل» (`invoice-form.tsx:2020-2029`) الذي يستدعي `onPost()` مباشرة.

**الأثر العملي**: محاسب يفتح فاتورة مسودة موجودة، يعدّل كمية/سعر/خصم بسطر، يغيّر العميل أو العملة، ثم يضغط «ترحيل» مباشرة (سيناريو طبيعي جداً — لا شيء بالواجهة يوحي بضرورة الحفظ أولاً، ولا رسالة تحذير، ولا تعطيل للزر عند وجود تعديلات غير محفوظة) → تمر `runValidation` بنجاح (لأنها تتحقق من القيم الجديدة الصحيحة بالذاكرة) → `post_invoice` يُرحّل **البيانات القديمة المخزَّنة قبل التعديل** → رسالة نجاح «تم ترحيل الفاتورة» تُعرض، والحالة تتحول لـ`posted` بالواجهة — يبدو للمستخدم أن ما يراه على الشاشة (بما فيه تعديلاته) هو ما تم ترحيله، بينما القيد المحاسبي والمخزون المتأثر يعكسان نسخة **سابقة وربما مختلفة جوهرياً** (كمية أو سعر أو عميل مختلف). لا توجد أي رسالة خطأ أو تحذير في أي مرحلة — العملية «تنجح» بصمت بمعطيات خاطئة. هذا أخطر من نمط «partial write» الموثَّق بتدقيق السندات — هنا الكتابة الفعلية بالقاعدة **صحيحة ومتّسقة داخلياً** (رأس + أسطر + قيد متطابقون) لكنها **ليست ما وافق عليه المستخدم لحظة الترحيل**.

بالمقابل، عندما لا يوجد `savedId` (أول ترحيل لفاتورة جديدة `mode="create"` لم تُحفظ من قبل، أو مسار `pattern.auto_post` عبر `onSave`، `invoice-form.tsx:1217-1226`) فالتسلسل صحيح: `onSave(true)` يحفظ ثم يرحّل بنفس الاستدعاء. الثغرة تخص حصراً **إعادة فتح فاتورة مسودة موجودة وتعديلها ثم الترحيل مباشرة** — وهو تحديداً مسار «صفحة `/invoices/[id]`» (`web/src/app/invoices/[id]/page.tsx`) الذي يمرّ `mode="edit"`.

## 2. لا مسار عكس/إلغاء لفاتورة مرحّلة من هذا النموذج على الإطلاق — وتأكيد أن الإصلاح السابق غطّى المسودات فقط

أزرار الإجراءات في `invoice-form.tsx:2009-2073` هي حصراً: «حفظ مسودة» (2012-2019)، «ترحيل» (2020-2029، مشروط بـ`pattern.generate_journal && canPost`)، «إلغاء المسودة» (2030-2064، يستدعي `invoiceApi.cancelDraftInvoice`)، و«رجوع للقائمة» (2067-2072). **لا يوجد أي زر رابع** لعكس/إلغاء فاتورة **مرحّلة**. `readOnly = status !== "draft" || !canEdit` (`invoice-form.tsx:286`) — بخلاف نموذجي سند القبض/الصرف اللذين يملكان زر «حفظ التعديلات (مدير)» يظهر لسند مرحّل (ولو كان معطَّلاً فعلياً بحسب تدقيق السندات)، **نموذج الفاتورة لا يملك أي مسار تحرير لفاتورة مرحّلة إطلاقاً حتى للأدمن** — `readOnly` لا يستثني `is_admin()` بتاتاً. هذا يعني أن ثغرة «كتابة جزئية عند تعديل رأس مرحّل من الأدمن» الموثَّقة بتدقيق الفواتير السابق (§2) **لا يمكن الوصول إليها من هذا النموذج بتاتاً** — هي فقط قابلة للاستغلال عبر نداء Supabase مباشر خارج الواجهة، وهذا تأكيد إيجابي (لا حاجة لإصلاح بالواجهة لهذا الجزء تحديداً).

لكن غياب أي بديل يعني عملياً: **لا توجد اليوم أي طريقة من واجهة الفاتورة لتصحيح فاتورة مرحّلة بها خطأ** — لا تعديل (حتى للأدمن) ولا عكس ولا إلغاء. زر «إلغاء المسودة» مقفول خلف `!readOnly` (`invoice-form.tsx:2030`) فلا يظهر أصلاً إلا في حالة `draft`. المسار الوحيد المتاح فعلياً لتصحيح فاتورة مرحّلة هو فاتورة مرتجع/مقابلة منفصلة (عبر خاصية «الفاتورة المرجعية»)، وهو حل محاسبي مقبول لكنه **يتطلب من المستخدم معرفة أن لا خيار آخر** — لا رسالة أو تلميح بالشاشة توضح ذلك عند عرض فاتورة `posted`.

## 3. تحميل الفاتورة المرجعية يبدّل العملة دون أي مزامنة لسعر الصرف — ولا تعبئة تلقائية لسعر الصرف بالنموذج إطلاقاً

`LoadedReferenceData` (`reference-invoice-api.ts:44-61`) **لا تملك حقل `exchangeRate` إطلاقاً**. `buildHeaderFields` (`reference-invoice-api.ts:164-200`) يضبط `currencyId: header.currency_id ?? ""` (سطر 187) **بلا أي شرط `settings.*`** — على خلاف كل الحقول الأخرى بنفس الدالة (`customerId`, `branchId`, `paymentTermsDays`...) المحكومة بأعلام `InvoiceReferenceSettings` (`load_party`, `load_cost_center`, `load_payment_terms`...). أي أن العملة تُستبدَل **دائماً** بعملة الفاتورة المرجعية عند أي عملية تحميل (كامل/رأس فقط/أسطر مختارة)، بلا استثناء يمكن تعطيله من إعدادات النمط.

في المقابل، `applyLoadedReferenceData` بالنموذج (`invoice-form.tsx:870-914`) يستقبل `loaded.currencyId` ويستدعي `setCurrencyId(loaded.currencyId)` (سطر 875) — لكنه **لا يلمس `exchangeRate` بتاتاً** لأن `LoadedReferenceData` لا يحمله أصلاً. النتيجة: بعد تحميل مرجع بعملة مختلفة عن عملة الفاتورة الحالية (مثال: فاتورة مرتجع بيع تُحمَّل من فاتورة بيع أصلية بعملة أجنبية بينما `exchangeRate` الحالي لا يزال 1 الافتراضي أو قيمة سابقة يدوية)، تصبح **العملة والسعر غير متطابقين** دون أي تنبيه.

هذا ليس عيباً معزولاً بل يكشف غياباً أوسع: حقل سعر الصرف (`invoice-form.tsx:239`, `const [exchangeRate, setExchangeRate] = useState<number | null>(1);`) **يبدأ دائماً بقيمة ثابتة `1`** لأي فاتورة جديدة، بصرف النظر عن العملة المختارة، ولا يُشتق أبداً من `currencies.exchange_rate` (السعر الحالي المخزَّن فعلياً بجدول العملات — موجود ومُدار عبر `currencyApi.updateExchangeRate`/`update_currency_exchange_rate`، `web/src/modules/currencies/services/currency-api.ts:79-86`). حتى `<select>` العملة بالرأس (`invoice-form.tsx:1487-1500`) لا يملك `onChange` سوى `setCurrencyId(e.target.value)` — لا استدعاء لجلب السعر الحالي لتلك العملة وتعبئته. المستخدم مطالَب بتذكّر إدخال السعر يدوياً في كل مرة يغيّر فيها العملة، بلا أي مساعدة أو تحقق من الاتساق.

## 4. `generate_journal` — حقل مُقفل بالكامل بواجهة الإعداد لكنه يتحكم بظهور زر الترحيل، ويُتجاوَز صامتاً بمسار الترحيل التلقائي

`invoice-form.tsx:2020`: `{pattern.generate_journal && canPost && (<button ... onPost>ترحيل</button>)}`. هذا هو **الاستهلاك الوحيد** لهذا الحقل بكامل كود TS (بحث شامل) — يتحكم حصراً بظهور زر «ترحيل».

لكن `invoice-pattern-form.tsx:1031-1040`:

```tsx
<label className="flex items-center gap-2 text-sm text-slate-500">
  <input type="checkbox" disabled checked={values.generate_journal} readOnly />
  توليد قيد يومية (مفعّل دائماً عند الترحيل حالياً)
</label>
```

الحقل `disabled`/`readOnly` بالكامل بشاشة إعداد النمط — **لا توجد أي وسيلة بالواجهة لضبطه `false`** لأي نمط جديد أو موجود؛ عمود القاعدة `generate_journal boolean not null default true` (`database/patch_invoices.sql:44`) وكل بذور الأنماط (`patch_invoice_seeds.sql`, `patch_composite_disassembly.sql`, `patch_invoice_manufacturing.sql`) تمرّر `true` صراحة. عملياً القيمة دائماً `true` اليوم، فزر «ترحيل» يظهر دوماً — **لكن لو أصبحت `false` يوماً** (بيانات قديمة، بذرة مستقبلية، أو تعديل مباشر بقاعدة البيانات) فلا توجد أي طريقة لإرجاعها `true` من الواجهة، وسيختفي زر «ترحيل» نهائياً لكل فواتير ذلك النمط دون أي رسالة تفسّر السبب.

الأخطر: مسار الترحيل التلقائي **لا يتحقق من هذا العلم إطلاقاً**. `onSave` (`invoice-form.tsx:1217-1226`):

```ts
if (andPost) {
  ... invoiceApi.postInvoice(saved.id) ...
} else if (pattern.auto_post) {
  const journalId = await invoiceApi.postInvoice(saved.id);   // بلا فحص pattern.generate_journal
  ...
}
```

فلو افترضنا نمطاً بـ`generate_journal=false` (مخفياً زر الترحيل اليدوي عمداً) و`auto_post=true` بآن واحد، فإن الضغط على «حفظ مسودة» فقط سيُرحّل الفاتورة تلقائياً رغم إخفاء الزر اليدوي — تناقض مباشر بين ما تُظهره الواجهة (`generate_journal` يمنع الترحيل اليدوي) وما يحدث فعلياً (`auto_post` يتجاوزه تماماً). هذه فجوة كامنة غير مستغَلة حالياً (بحكم القيمة الثابتة `true`) لكنها معمارية حقيقية.

## 5. قائمة الفواتير: لا ترقيم صفحات ولا بحث ولا فلترة — تحميل كل السجلات دفعة واحدة، بنفس نمط قائمة السندات

`invoiceApi.listInvoices()` (`invoice-api.ts:164-181`) يجلب **كل** صفوف `invoices` بلا `.range()`/`.limit()`، مع `select` متداخل (`invoice_patterns`, `branches`, `customers`, `vendors`) لكل صف، مرتّبة فقط بـ`invoice_date`/`created_at` تنازلياً. `web/src/app/invoices/page.tsx` (السطور 28-56) يستدعيها كاملة عند كل تحميل صفحة، و`InvoicesListTable` (`invoices-list-table.tsx`) يعرض النتيجة كاملة بلا أي تقطيع.

لا يوجد بصفحة `/invoices` **أي** حقل بحث نصي (برقم الفاتورة أو اسم الطرف)، ولا فلتر تاريخ (من–إلى)، ولا فلتر حالة (مسودة/مرحّلة/ملغاة)، ولا فلتر نمط/نوع تجاري، ولا فلتر فرع — القسم الوحيد القابل للتصفية هو بطاقات إنشاء الفواتير الجديدة (حسب النمط)، وهي شيء مختلف عن قائمة العرض. لتطبيق محاسبي مع محاسب واحد يتوسّع سجل فواتيره تراكمياً، هذا يعني تحميلاً متزايد الحجم عند كل فتح للصفحة، ولا وسيلة سريعة لإيجاد فاتورة شهر أو عميل معيّن سوى التمرير اليدوي — يطابق تماماً الفجوة الموثَّقة بتدقيق قائمة السندات (`2026-07-25-payment-receipt-vouchers-audit.md` §5)، مؤكَّدة الآن أيضاً في قائمة الفواتير تحديداً.

## 6. عدم اتساق مع نظام التصميم المشترك (أزرار/Badge/Modal)

- **الأزرار**: كل أزرار الإجراءات بالنموذج (`invoice-form.tsx:2012-2072`: حفظ مسودة، ترحيل، إلغاء المسودة، رجوع للقائمة) تستخدم فئات Tailwind خام (`rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white`، `rounded-md border border-emerald-400 bg-emerald-50 ...`، إلخ) بدل الفئات المشتركة `.btn`/`.btn-primary`/`.btn-outline` المعرَّفة بـ`web/src/app/globals.css:123-176`. نفس النمط في `reference-lines-picker.tsx:126-139` (زرا «إلغاء»/«تحميل المحدد»). بالمقابل `invoices-list-table.tsx:52` يستخدم فعلاً `className="btn btn-sm btn-outline"` — أي أن **قائمة** الفواتير متّسقة مع نظام التصميم بينما **نموذج** الفاتورة نفسه ليس كذلك، تناقض داخل نفس الوحدة.
- **Badge الحالة**: `InvoiceStatusChip` (`invoice-status-chip.tsx:5-21`) يُعرِّف ألوانه الخاصة (`bg-amber-50 text-amber-800`, `bg-emerald-50 text-emerald-800`, `bg-slate-100 text-slate-600`) بدل `.badge-success`/`.badge-muted`/`.badge-info` (`globals.css:178-199`) — نفس العيب الموثَّق بتدقيق `StatusChip` الخاص بالسندات. إضافة لذلك، `InvoiceOpenMovementsPanel` (`invoice-open-movements-panel.tsx:15`) يستورد `StatusChip` **من وحدة السندات** (`@/modules/vouchers/components/status-chip`) — نفس المكوّن غير المتّسق موضَّح بذلك التدقيق، مُعاد استخدامه هنا داخل شاشة الفاتورة أيضاً.
- **Modal**: تأكيد إلغاء المسودة (`invoice-form.tsx:2035-2041`) يستخدم `window.confirm()` الأصلي بدل مكوّن `Modal` المشترك (`web/src/components/modal.tsx`) — نفس النمط الموثَّق بتدقيق السندات (لا دعم RTL متّسق، لا محتوى غني، قابل للحجب بمانعات النوافذ المنبثقة).

## 7. ثغرات صغيرة بتحقق أسطر المواد

- **تحقق السعر غير متماثل مع تحقق الكمية**: `validate-invoice.ts:152-154` يتحقق من `quantity <= 0` **دائماً** (حفظ مسودة أو ترحيل)، بينما تحقق `unit_price < 0` (`validate-invoice.ts:276-280`) محصور داخل `if (context.forPost)` فقط. أي أن حفظ مسودة بسطر سعره سالب **لا يُرفض إطلاقاً** — يُكتشف فقط لاحقاً عند محاولة الترحيل. أثر عملي محدود (الفاتورة تبقى مسودة) لكنه تحقق غير متّسق بين حقلين متكافئين بنفس السطر.
- **لا سقف على «إضافي %» إطلاقاً**: خصم السطر محكوم بـ`max_discount_percent` القابل للضبط بالنمط ويُتحقَّق منه بـ`validate-invoice.ts:97-140`، بينما حقل «إضافي %» (`invoice-material-lines-table.tsx:974-991`) لا يقابله أي سياسة `maxExtraPercent` أو تحقق مكافئ بكامل `validate-invoice.ts` (بحث شامل صفر نتائج) — حتى `max="100"` بخاصية HTML للحقل نفسه غير مدعوم بأي منطق أعمال، مجرد قيمة افتراضية شكلية.
- **عدم اتساق إعادة الضبط بين الخصم والإضافي**: عند تعديل نسبة الخصم يُعاد `discount_amount` إلى `null` (`invoice-material-lines-table.tsx:940-943`)، بينما عند تعديل نسبة الإضافي يُعاد `extra_amount` إلى `0` لا `null` (`invoice-material-lines-table.tsx:985-988`) — نفس الزوج المتكافئ منطقياً يُصفَّر بقيمتين مختلفتي النوع (`null` مقابل `0`)، عرضة لسلوك مختلف صامت لو تغيّر منطق الحفظ لاحقاً ليفرّق بين `null`/`0`.
- **حقول `type="number"` قابلة لتجاوز `min`/`max` بالكتابة اليدوية**: الكمية (`min={0.000001}`, سطر 728)، السعر (`min={0}`, سطر 785)، ونسب الخصم/الإضافي (`max={100}`) — خاصية `min`/`max` على `type="number"` لا تمنع كتابة قيمة خارج النطاق يدوياً (تؤثر فقط على أسهم الزيادة/النقصان)، فالرادع الوحيد الفعلي هو `validateInvoice` عند الحفظ/الترحيل لا الحقل نفسه — نفس نمط الملاحظة الموثَّقة بتدقيق سندات القبض/الصرف لحقل المبلغ.

## 8. لا تحقق تعادل مدين/دائن على مستوى واجهة أسطر الحسابات الإضافية

`InvoiceAccountLinesTable` (`invoice-account-lines-table.tsx:75-80`) يحسب `debitTotal`/`creditTotal` ويعرضهما فقط كنص معلوماتي («مدين: ... · دائن: ...») بلا أي مقارنة أو تنبيه بصري عند عدم التعادل. `validate-invoice.ts` لا يتحقق من تعادل هذه الأسطر إطلاقاً (فحصه الوحيد المتعلق بها هو `hasAccounts = ... line.amount > 0` لغرض «هل الفاتورة فارغة»، `validate-invoice.ts:251-253`). الشبكة الوحيدة الفعلية هي فحص توازن القيد الكامل داخل `post_invoice()` نفسه (`raise exception 'Posted invoice journal is unbalanced...'`، `database/patch_invoice_pricing_cost.sql:1471`) — أي أن عدم التعادل **لن يمرّ للقاعدة بصمت** (نقطة إيجابية، بخلاف فجوات أخرى موثَّقة بهذا التقرير)، لكنه يُكتشف فقط بلحظة الترحيل عبر رسالة خطأ عامة غير موجّهة لسطر بعينه، بدل تنبيه فوري بالشاشة أثناء الإدخال.

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **إصلاح `onPost` ليحفظ التعديلات المعلّقة قبل الترحيل** (`invoice-form.tsx:1237-1261`) — إما استدعِ `onSave` (بدون منع الترحيل) قبل `invoiceApi.postInvoice(savedId)` دائماً عندما `savedId` موجود، أو — إن كان القصد فصل «حفظ» عن «ترحيل» عمداً — أضف مقارنة صريحة بين الحالة المحفوظة والحالة الحالية بالذاكرة (dirty-check) وامنع الترحيل مع رسالة واضحة («لديك تعديلات غير محفوظة — احفظ أولاً») بدل السماح بترحيل بيانات قديمة بصمت. هذه أخطر ثغرة بالنموذج لأنها تنتج قيداً محاسبياً صحيحاً شكلياً لكنه لا يطابق ما وافق عليه المستخدم.

### 🟠 عالٍ

2. **مزامنة سعر الصرف عند تحميل مرجع بعملة مختلفة** — أضف `exchangeRate` إلى `LoadedReferenceData` (`reference-invoice-api.ts:44-61`)، اجلبه من رأس الفاتورة المرجعية عند اختلاف العملة، وطبّقه في `applyLoadedReferenceData` (`invoice-form.tsx:870-914`). بشكل أوسع: اربط `<select>` العملة بالرأس (`invoice-form.tsx:1487-1500`) بجلب `currencies.exchange_rate` الحالي وتعبئته تلقائياً بدل الاعتماد على قيمة `1` الافتراضية الثابتة (`invoice-form.tsx:239`) في كل مرة.
3. **إضافة ترقيم صفحات وبحث/فلترة لصفحة `/invoices`** — فلتر تاريخ (من–إلى)، حالة، نمط، وبحث نصي برقم الفاتورة/اسم الطرف، مع `.range()` على `invoiceApi.listInvoices()` (`invoice-api.ts:164-181`) بدل تحميل كل السجلات دفعة واحدة.
4. **توضيح/توثيق أن لا مسار لتصحيح فاتورة مرحّلة من الواجهة** — إما أضف تنبيهاً صريحاً بالشاشة عند عرض فاتورة `posted` يوجّه لإنشاء فاتورة مرجعية/مرتجع، أو (بالتوافق مع توصية تدقيق الفواتير السابق #4) نفّذ مسار `cancel_invoice`/عكس فعلي للفواتير المرحّلة وأضف زره لهذا النموذج تحديداً.

### 🟡 متوسط

5. **معالجة تعارض `generate_journal`/`auto_post`** — اجعل مسار `pattern.auto_post` بـ`onSave` (`invoice-form.tsx:1222-1226`) يحترم `pattern.generate_journal` بنفس شرط زر الترحيل اليدوي، أو احذف `generate_journal` كإعداد مستقل ما دام مقفولاً دائماً على `true` بواجهة الإعداد (`invoice-pattern-form.tsx:1031-1040`) وغير قابل للتغيير فعلياً.
6. **توحيد أزرار النموذج مع نظام التصميم** — استبدل الفئات الخام بأزرار `invoice-form.tsx:2012-2072` وأزرار `reference-lines-picker.tsx:126-139` بـ`.btn`/`.btn-primary`/`.btn-outline`؛ وحّد `InvoiceStatusChip` مع `.badge-success`/`.badge-muted`؛ استبدل `window.confirm()` بمكوّن `Modal` المشترك لتأكيد إلغاء المسودة.
7. **إضافة سقف قابل للضبط لـ«إضافي %» على مستوى السطر** مكافئ لـ`max_discount_percent`، أو على الأقل تحقق حد أعلى معقول (مثل 100%) بـ`validate-invoice.ts` بدل الاعتماد فقط على خاصية HTML الشكلية غير المُنفَّذة.
8. **تنبيه فوري بعدم تعادل مدين/دائن بأسطر الحسابات الإضافية** — قارن `debitTotal`/`creditTotal` (`invoice-account-lines-table.tsx:75-80`) وأظهر رسالة تحذير حمراء عند عدم التطابق بدل الانتظار لرسالة خطأ عامة من `post_invoice()`.

### 🔵 معماري

9. **توحيد تحقق السعر مع تحقق الكمية** — انقل فحص `unit_price < 0` (`validate-invoice.ts:276-280`) خارج شرط `forPost` ليعمل عند حفظ المسودة أيضاً، اتساقاً مع فحص `quantity <= 0` المُطبَّق دائماً.
10. **توحيد قيمة إعادة الضبط بين خصم/إضافي السطر** (`null` مقابل `0`) — اختر قيمة واحدة موحّدة (`invoice-material-lines-table.tsx:940-943` مقابل `985-988`) لتقليل خطر انحراف صامت بمنطق حفظ مستقبلي يميّز بين الاثنين.
11. **استبدال `StatusChip` المستورد من وحدة السندات** (`invoice-open-movements-panel.tsx:15`) بمكوّن Badge مشترك موحَّد بدل الاعتماد على مكوّن وحدة أخرى غير متّسقة أصلاً مع نظام التصميم.

## ملحق — ملفات مرجعية رئيسية

- `web/src/modules/invoices/components/invoice-form.tsx` — `onSave` (1157-1235)، `onPost` (1237-1261)، `runValidation` (1001-1155)، `readOnly` (286)، زر الترحيل (2020)، أزرار الإجراءات (2009-2073)، `exchangeRate` الافتراضي (239)، `applyLoadedReferenceData` (870-914).
- `web/src/modules/invoices/components/invoice-material-lines-table.tsx` — حقول الكمية/السعر (708-796)، إعادة ضبط الخصم/الإضافي (927-1016).
- `web/src/modules/invoices/components/invoice-account-lines-table.tsx` — `debitTotal`/`creditTotal` (75-80)، بلا تحقق تعادل.
- `web/src/modules/invoices/components/invoice-status-chip.tsx` — ألوان مخصّصة (5-21).
- `web/src/modules/invoices/components/invoices-list-table.tsx` — استخدام صحيح لـ`.btn btn-outline` (52)، للمقارنة.
- `web/src/modules/invoices/components/reference-lines-picker.tsx` — أزرار خام (126-139).
- `web/src/modules/invoices/components/invoice-open-movements-panel.tsx` — استيراد `StatusChip` من وحدة السندات (15).
- `web/src/modules/invoices/components/invoice-pattern-form.tsx` — خانة `generate_journal` المقفولة (1031-1040).
- `web/src/modules/invoices/services/invoice-api.ts` — `listInvoices` (164-181، بلا ترقيم صفحات)، `saveInvoice` (283-316)، `postInvoice` (394-414)، `cancelDraftInvoice` (416-422).
- `web/src/modules/invoices/services/reference-invoice-api.ts` — `LoadedReferenceData` (44-61، بلا `exchangeRate`)، `buildHeaderFields` (164-200، `currencyId` بلا شرط `settings`).
- `web/src/modules/invoices/utils/validate-invoice.ts` — تحقق الكمية الدائم (152-154) مقابل تحقق السعر عند الترحيل فقط (276-280)، غياب سقف «إضافي %» (بحث شامل).
- `web/src/app/invoices/page.tsx` — بلا بحث/فلترة (كامل الملف).
- `web/src/app/invoices/[id]/page.tsx` — `mode="edit"` بلا أي `PermissionGate` إضافي حول `InvoiceForm`.
- `database/patch_invoices.sql:44` — `generate_journal boolean not null default true`.
- `database/patch_invoice_pricing_cost.sql:1471` — فحص توازن القيد النهائي داخل `post_invoice()`.
- `database/patch_invoices_audit_fix.sql:306-349` — `cancel_draft_invoice()` (يغطي المسودات فقط، لا فاتورة مرحّلة).
- `web/src/app/globals.css` — `.btn`/`.btn-primary`/`.btn-outline` (123-176)، `.badge*` (178-199).
- `web/src/components/modal.tsx` — المكوّن المشترك غير المُستخدَم بنموذج الفاتورة.
