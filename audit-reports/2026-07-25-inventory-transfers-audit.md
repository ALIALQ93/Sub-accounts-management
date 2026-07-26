# تدقيق دقيق — شاشات مناقلات المخزون (Inventory Transfers)

منهجية: قراءة الكود الفعلي (SQL + TypeScript) لثلاث شاشات Next.js (`web/src/app/invoices/transfers/page.tsx`, `.../new/page.tsx`, `.../[id]/page.tsx`) ومكوّناتها (`transfers-list-table.tsx`, `stuck-transfers-alert.tsx`, `transfer-api.ts`) وتتبّع كل استدعاء إلى مصدره الفعلي في `database/setup_all.sql` — وهو الأصل المُجمَّع (compiled) الناتج عن `database/build_setup_all.ps1`، حيث **النسخة الفعّالة من أي دالة SQL هي آخر `create or replace` يُطبَّق**، وليس أول نتيجة بحث نصي. تحققتُ تحديداً من أن قسم `post_invoice()` المرجعي بالتقرير هو النسخة الأخيرة (`create or replace function public.post_invoice` عند `database/setup_all.sql:19103`، آخر تعريف من 4 نسخ) وليس نسخة قديمة تم استبدالها لاحقاً — وهو ما أوقع تناقضاً أولياً أثناء البحث (نسخة أقدم عند السطر 5682 تحسب تكلفة التحويل بشكل مختلف عن النسخة الفعّالة).

هذا التقرير **لا يعيد اشتقاق** ما ورد بـ`audit-reports/2026-07-22-materials-warehouses-audit.md` §5 (بنية "فاتورتان منفصلتان"، انعدام الذرّية بين الطرفين) ولا التوصية #5 هناك (تنبيه المناقلات العالقة) إلا بقدر التحقق من تنفيذها الفعلي — بل يغوص في سلوك الشاشات الثلاث نفسها سطراً بسطر.

## 1. خريطة الشاشات الفعلية

| الشاشة | الملف | الوظيفة |
|---|---|---|
| قائمة المناقلات | `web/src/app/invoices/transfers/page.tsx` | تحميل `transferApi.listTransfers()` + عرض `StuckTransfersAlert` + `TransfersListTable` |
| مناقلة جديدة | `web/src/app/invoices/transfers/new/page.tsx` | إنشاء مستند مناقلة (`inventory_transfers` + `inventory_transfer_lines`) بحالة `draft` فقط — **لا ترحيل مخزوني هنا** |
| تفاصيل مناقلة | `web/src/app/invoices/transfers/[id]/page.tsx` | عرض رأس المستند + أسطره، وروابط لإنشاء/عرض فاتورتي الإخراج والإدخال |
| تنبيه العالقة | `web/src/modules/invoices/components/stuck-transfers-alert.tsx` | مكوّن مستقل يُحمَّل داخل شاشة القائمة فقط |
| طبقة البيانات | `web/src/modules/invoices/services/transfer-api.ts` | كل استدعاءات Supabase الخاصة بالمناقلات |

**نقطة جوهرية للفهم:** إنشاء "المناقلة" (transfer) لا يحرّك أي مخزون إطلاقاً — فقط `INSERT` بحالة `draft`. التحريك الفعلي يحدث فقط عندما يُرحَّل (`post_invoice`) نموذج **فاتورة** منفصلة تماماً (نمط `transfer_out`/`transfer_in`) عبر `/invoices/new?pattern=...&transfer=...&role=out|in` — وهو نفس نموذج الفاتورة العام (`invoice-form.tsx`)، لا توجد شاشة "استلام" مخصّصة. هذا يعني أن كل تعقيد فحص/تحقق نموذج الفاتورة العام (المخزون، الوحدات، إلخ) ينطبق حرفياً هنا أيضاً، لكن مع حقول تحويل إضافية (`inventory_transfer_id`, `transfer_role`) قد لا تُحقَّق بنفس الصرامة كما سيلي.

## 2. زر "فاتورة إدخال" لا يختفي أبداً — حتى بعد استلام المناقلة بالكامل

مقارنة مباشرة بين معالجة الإخراج والإدخال في نفس الملفين:

**`web/src/modules/invoices/components/transfers-list-table.tsx:61-76`**
```tsx
{canCreate && outPatternId && !item.out_invoice_id && (   // ← محمي بفحص !out_invoice_id
  <Link ...>إخراج</Link>
)}
{canCreate && inPatternId && (                             // ← بلا أي فحص !in_invoice_id
  <Link ...>إدخال</Link>
)}
```

**`web/src/app/invoices/transfers/[id]/page.tsx:80-103`**
```tsx
{outPatternId && !transfer.out_invoice_id && ( ... "فاتورة إخراج" ... )}
{transfer.out_invoice_id && ( ... "عرض فاتورة الإخراج" ... )}
{inPatternId && ( ... "فاتورة إدخال" ... )}                 // ← نفس الغياب هنا (سطر 96)
{transfer.in_invoice_id && ( ... "عرض فاتورة الإدخال" ... )}
```

زر "إخراج" يختفي بشكل صحيح بمجرد ترحيل فاتورة الإخراج (`!item.out_invoice_id`)، لكن زر "إدخال" **يبقى ظاهراً إلى الأبد** بغض النظر عن حالة المناقلة أو وجود `in_invoice_id` — حتى لمناقلة بحالة `received` مكتملة تماماً. هذا ليس فرقاً تصميمياً مقصوداً (لا تعليق أو تبرير بالكود)، بل غياب فحص متماثل نسيه من كتب الكود.

**الأثر الفعلي:** لا يوجد أي حائل آخر يمنع الضرر. تتبّعت المسار كاملاً:
- `web/src/app/invoices/new/page.tsx` يمرر `mode="create"` دائماً — كل زيارة لرابط `?transfer=X&role=in` تُنشئ فاتورة **جديدة** بلا أي فحص لوجود فاتورة إدخال سابقة (مسودة أو مرحّلة) لنفس المناقلة.
- `invoice-form.tsx:697-758` يملأ الأسطر تلقائياً من `transfer.lines` دون أي فحص لـ`transfer.status` (لا تحذير إن كانت الحالة `received` فعلاً).
- لا قيد فريد (`unique`) على `(inventory_transfer_id, transfer_role)` في جدول `invoices` بـ`database/setup_all.sql` (تحقق شامل: بحث عن `unique.*transfer` لا يُظهر إلا `transfer_no` و`(transfer_id, line_no)`).
- عند ترحيل الفاتورة الثانية، فرع `transfer_in` بـ`post_invoice()` (`database/setup_all.sql:19562-19669`) يُدرج حركة `inventory_movements` جديدة بكامل الكمية (`v_qty_recv`) **مرة أخرى** إلى مستودع الوجهة، ويُنشئ قيداً محاسبياً ثانياً يدين المخزون ويُقفل "بضاعة بالطريق" مجدداً — إضافة فعلية مضاعفة للرصيد والقيمة الدفترية دون أي تحذير للمستخدم.

هذا خلل **حرج وقابل للحدوث يومياً بسهولة** (مستخدم ينقر "إدخال" مرتين بالخطأ، أو يعود لاحقاً وينسى أنه استلم فعلاً) وليس حالة نادرة.

## 3. لا حماية من فواتير مسودة مكرّرة لنفس الطرف قبل الترحيل أصلاً

حتى لو أُصلح غياب الفحص في §2، تبقى ثغرة أعمق: `out_invoice_id`/`in_invoice_id` على `inventory_transfers` لا تُحدَّث إلا **عند الترحيل الفعلي** (داخل `post_invoice()`، `database/setup_all.sql:19556-19560` و`19654-19669`)، وليس عند مجرد إنشاء الفاتورة كمسودة. أي: مستخدم ينقر "إخراج"، يملأ الفاتورة، يتركها **مسودة** (لا يرحّلها)، يعود لشاشة المناقلة — الزر "إخراج" **لا يزال ظاهراً** (لأن `out_invoice_id` ما زال `null`) فينقر مرة أخرى فيُنشئ فاتورة إخراج مسودة ثانية لنفس المناقلة. لا شيء بالواجهة (`invoice-form.tsx`) ولا بقاعدة البيانات يمنع أو حتى يُحذّر من مسودتين متزامنتين بنفس `(inventory_transfer_id, transfer_role)`.

## 4. أعمدة `inventory_transfer_lines` الحيوية ميتة تماماً — تكسر تتبّع الشحن والاستلام الجزئي

جدول `inventory_transfer_lines` (`database/setup_all.sql:4242-4255`) يحتوي `qty_shipped`, `qty_received`, `unit_cost_at_ship`, `out_line_id`, `in_line_id` — مصمّمة صراحة لتُحدَّث بعد ترحيل كل من فاتورتي الإخراج/الإدخال. **بحث شامل في كامل `database/setup_all.sql` يؤكد عدم وجود أي `UPDATE public.inventory_transfer_lines` إطلاقاً** (الجدول يُدرج فيه فقط عند الإنشاء بـ`transfer-api.ts:151-164`، بقيم `qty_shipped`/`qty_received` الافتراضية = 0 ولا تُلمس بعدها أبداً). النتيجة سلسلة أعطال صامتة مترابطة:

1. **شاشة تفاصيل المناقلة تعرض دائماً "٠" بعمودي "المشحون" و"المستلم"** (`web/src/app/invoices/transfers/[id]/page.tsx:139-144`, يقرأ `line.qty_shipped`/`line.qty_received` عبر `transfer-api.ts:118-126`) — حتى لمناقلة حالتها `received` فعلياً ومُرحّلة بالكامل. هذا يناقض مباشرة طلب التدقيق عن "صحة عرض تناسب التكلفة عند الاستلام الجزئي": **لا تناسب تكلفة يُعرض بهذه الشاشة إطلاقاً** — لا تكلفة، ولا نسبة استلام حقيقية، فقط أصفار مضلِّلة دائماً.
2. **منطق تحديث حالة المناقلة تلقائياً لا يمكن أن ينتج `partially_received` أبداً.** الشرط الفعلي بآخر نسخة من `post_invoice()` (`database/setup_all.sql:19657-19665`):
   ```sql
   status = case
     when exists (
       select 1 from public.inventory_transfer_lines itl
       where itl.transfer_id = v_inv.inventory_transfer_id
         and itl.qty_received < itl.qty_shipped
         and itl.qty_shipped > 0
     ) then 'partially_received'
     else 'received'
   end,
   ```
   بما أن `itl.qty_shipped` يبقى `0` للأبد، الشرط `itl.qty_shipped > 0` **دائماً كاذب**، والـ`EXISTS` كله يفشل دائماً — فتقفز الحالة مباشرة من `dispatched` إلى `received` بمجرد ترحيل أي فاتورة إدخال، بصرف النظر عن كون الاستلام جزئياً فعلياً على مستوى `invoice_material_lines.qty_received`. حالة `partially_received` **قابلة للعرض بالواجهة** (`transfers-list-table.tsx:10`, `stuck-transfers-alert.tsx:28`) لكن **لا مسار برمجي حقيقي يصل إليها تلقائياً**.
3. **تعبئة نموذج فاتورة الإدخال تستخدم دائماً الكمية المطلوبة، لا المشحونة فعلياً.** `invoice-form.tsx:726-729`:
   ```ts
   const qty =
     transferRole === "in"
       ? line.qty_shipped || line.qty_ordered   // qty_shipped == 0 دائماً → يسقط دائماً على qty_ordered
       : line.qty_ordered;
   ```
   حتى لو شُحن فعلياً أقل من المطلوب (نقص مخزون بالمصدر مثلاً)، فاتورة الإدخال تُعبَّأ افتراضياً بكامل الكمية المطلوبة الأصلية — الموظف المستلم لا يرى أي إشارة آلية لما شُحن فعلياً، ويعتمد كلياً على معرفة خارجية (مكالمة هاتفية، إلخ) لتصحيح الكمية يدوياً بالسطر.

**جوهر الملاحظة:** طبقة التكلفة والتناسب الفعلية (`calc_outbound_line_total_cost`, `calc_inbound_inventory_amount`, والتناسب اليدوي `v_line_cost * v_qty_base_recv / v_row.quantity_base` بـ`database/setup_all.sql:19609-19616`) **تعمل بشكل صحيح فعلاً على مستوى `invoice_material_lines`** عند الترحيل — التدقيق السابق كان محقاً بأن "الاستلام الجزئي مدعوم". لكن مستند المناقلة نفسه (`inventory_transfer_lines`) — وهو ما تعرضه هذه الشاشة تحديداً — **مفصول تماماً** عن تلك الحسابات ولا يعكسها أبداً. طلب التدقيق عن "صحة عرض تناسب التكلفة عند الاستلام الجزئي بهذه الشاشة تحديداً" إجابته: **لا يوجد أي عرض من الأساس، لا صحيح ولا خاطئ.**

## 5. لا تحقق من ارتباط المستودع بالفرع عند إنشاء المناقلة — لا بالواجهة ولا بقاعدة البيانات

`database/setup_all.sql:4066-4085` — تعريف `inventory_transfers`: يوجد قيد `check (from_branch_id <> to_branch_id)` (سطر 4084) لكن **لا يوجد أي قيد أو تريغر** يتحقق أن `from_warehouse_id.branch_id = from_branch_id` أو `to_warehouse_id.branch_id = to_branch_id`.

بالواجهة (`web/src/app/invoices/transfers/new/page.tsx`)، قوائم المستودعات تُفلتَر حسب الفرع المختار حالياً (`warehousesFor()`, سطر 115-116)، لكن **لا يوجد أي `useEffect` يُصفّر `fromWarehouseId`/`toWarehouseId` عند تغيير `fromBranchId`/`toBranchId`** (تحقق شامل بالملف: 4 حالات `useState` مستقلة تماماً، سطر 25-28، وحيد useEffect بالملف مخصص فقط لتحميل البيانات الأولية سطر 43-68). سيناريو ملموس: يختار المستخدم فرع المصدر A فمستودعه W1، ثم **يغيّر رأيه** ويبدّل فرع المصدر إلى B — القائمة المنسدلة للمستودع تعيد عرض مستودعات B فقط (فيبدو الحقل فارغاً بصرياً لأن W1 لم يعد ضمن الخيارات)، لكن حالة React الداخلية `fromWarehouseId` **تبقى محتفظة بقيمة W1** (تابعة للفرع A). فحص الإرسال (`onSubmit`, سطر 76-88) يتحقق فقط من عدم الفراغ (`!fromWarehouseId`) — وهو غير فارغ فعلياً — فيمرّ ويُنشئ مستنداً بمزيج فرع/مستودع متضارب فعلياً.

هذا لا يُكتشف عند إنشاء المناقلة نفسها (تُحفظ بنجاح، بلا أي رسالة). يُكتشف لاحقاً وبشكل مربك فقط عندما يحاول المستخدم توليد فاتورة الإخراج/الإدخال: تريغر `invoice_material_lines_apply_quantities()` (`database/setup_all.sql:4469-4475`) يرفض بالرسالة الخام غير المترجمة:
```
raise exception 'warehouse branch must match line branch_id.';
```
والتي تصل للمستخدم كما هي عبر `notifyError(err.message)` (نمط `throwIfSupabaseError` بكل ملفات الـAPI) — رسالة إنجليزية تقنية بواجهة عربية بالكامل، بلا أي شرح أن السبب هو مناقلة أُنشئت بمستودع لا ينتمي فعلياً للفرع المختار. المستخدم يبقى عالقاً بمناقلة لا يمكن معالجتها ولا شرح واضح لسببها (ولا مسار لحذفها، انظر §12).

## 6. تنبيه "المناقلات العالقة" — مُنفَّذ فعلاً، لكن بخلل في نقطة القياس الزمنية

**تأكيد إيجابي أولاً:** توصية التقرير الأوسع (#5، "أضف تقريراً/تنبيهاً لعرض التحويلات العالقة… مشابه لـ`inventory-shortage-alert.tsx`") **مُنفَّذة فعلاً** — `web/src/modules/invoices/components/stuck-transfers-alert.tsx` موجود، مُدمج بشاشة القائمة (`transfers/page.tsx:9,81`)، ويتبع نمط تنبيه المخزون الموجود مسبقاً (بطاقة كهرمانية، قائمة معاينة محدودة + رابط "المزيد").

**لكن آلية القياس فيه معيبة:** `stuck-transfers-alert.tsx:18-23`:
```ts
function isStuck(item: InventoryTransferListItem, nowMs: number): boolean {
  if (!OPEN_STATUSES.has(item.status)) return false;
  const anchor = Date.parse(item.created_at);   // ← وقت إنشاء المسودة، وليس وقت الشحن
  ...
  return nowMs - anchor >= STUCK_AFTER_DAYS * 24 * 60 * 60 * 1000;
}
```
المُرساة الزمنية هي `created_at` (لحظة إنشاء مستند المناقلة كمسودة)، وليست `shipped_at` (لحظة ترحيل فاتورة الإخراج فعلياً، وهي اللحظة المنطقية لبدء عدّ "بضاعة بالطريق"). الجدول نفسه يحتوي عمود `shipped_at` (`database/setup_all.sql:4079`) ويُحدَّث فعلياً عند الشحن (`update ... set status='dispatched', shipped_at=coalesce(shipped_at, now())`, سطر 19558)، لكنه **لا يُجلب أصلاً** — `transferApi.listTransfers()` (`transfer-api.ts:62-73`) لا يختاره ضمن أعمدة `select`، ونوع `InventoryTransferListItem` (`web/src/modules/invoices/types.ts:274-283`) لا يعرّفه إطلاقاً.

**الأثر:** مناقلة تُنشأ كمسودة وتبقى بهذه الحالة (لا حساب `OPEN_STATUSES` لها، فهي غير "عالقة" بعد) لمدة 5 أيام قبل أن يُشحن منها أي شيء، ثم تُشحن فعلياً منذ دقيقة واحدة فقط — ستظهر **فوراً** في تنبيه "عالقة منذ 3 أيام فأكثر" رغم أنها بدأت الشحن للتو. عكسياً، لو كان تسلسل العمل الطبيعي إنشاء وشحن بنفس اليوم (الأرجح عملياً)، الفرق ضئيل عملياً — لكن الخلل بنيوي وقابل لإعطاء نتائج مضللة كلما تأخر إصدار فاتورة الإخراج عن إنشاء مستند المناقلة.

## 7. توليد `transfer_no` غير ذرّي، وتسميته "سنوية" مضلِّلة

`transfer-api.ts:50-59`:
```ts
async function nextTransferNo(): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabase.from("inventory_transfers").select("*", { count: "exact", head: true });
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `TR-${year}-${seq}`;
}
```
مشكلتان مستقلتان:
- **سباق كتابة كلاسيكي**: `count()` ثم `+1` بدون أي قفل أو تسلسل ذرّي (لا `sequence`، لا `select ... for update`). طلبان متزامنان لإنشاء مناقلتين قد يحسبا نفس `count` فيولّدا نفس `transfer_no`. يوجد قيد `unique` فعلي على العمود (`database/setup_all.sql:4068`) فالفشل **صاخب** (لن يحدث تلف بيانات صامت) — لكن الرسالة ستكون خطأ Postgres خام غير مترجم (`duplicate key value violates unique constraint...`) بلا أي منطق إعادة محاولة بالواجهة.
- **الشكل `TR-YYYY-NNNN` يُوحي بتسلسل يُعاد ضبطه كل سنة، لكنه فعلياً عدّاد تراكمي مدى الحياة** (`count` بلا أي فلتر على السنة). في يناير من أي سنة جديدة، أول مناقلة لن تحمل الرقم `0001` بل رقماً استمرارياً من كل المناقلات السابقة — تناقض بصري بين الشكل والمضمون قد يربك القراءة المحاسبية لاحقاً (على غرار نفس أنماط الترقيم بأجزاء أخرى من النظام إن كانت تعتمد ترقيماً سنوياً حقيقياً).

## 8. شاشة تفاصيل المناقلة لا تعرض المستودعات، ولا تواريخ الشحن/الاستلام، ولا الملاحظات

قراءة كاملة لـ`web/src/app/invoices/transfers/[id]/page.tsx` (154 سطراً) تؤكد أن الشاشة تعرض فقط: رقم المناقلة، الحالة (وبالإنجليزية الخام، انظر §10)، أزرار الفواتير، وجدول أسطر (المادة/الوحدة/الكميات). **لا تُعرض** — رغم توفرها بالكامل في `InventoryTransferDetail` المُجلب فعلياً (`getTransfer()` يستخدم `select("*")` على الرأس، `transfer-api.ts:91-95`):
- اسم مستودع المصدر ولا مستودع الوجهة (`from_warehouse_id`/`to_warehouse_id` موجودان بالنوع لكن غير مُستخدَمين إطلاقاً بملف الصفحة — لا حتى بصيغة UUID خام).
- `shipped_at` و`received_at` — غير معرَّفين حتى بنوع `InventoryTransferDetail` (`types.ts:299-311`) رغم عودتهما من `select("*")`.
- `notes` — معرَّف بالنوع (`notes: string | null`) ومُرجَع من الاستعلام، لكن **لا يُعرض بالصفحة إطلاقاً** (يُستخدم فقط بشكل غير مباشر كوصف تلقائي لفاتورتي الإخراج/الإدخال بـ`invoice-form.tsx:711-715`، فيختفي من مستند المناقلة نفسه).

**الأثر على "هل يمكن للمستخدم إيجاد/إتمام جانب الاستلام بسهولة":** موظف يفتح تفاصيل مناقلة بحالة `dispatched` ليعرف "أين ينبغي أن يستلم البضاعة فعلياً" لا يرى اسم المستودع الهدف بهذه الشاشة إطلاقاً — يعرف فقط اسم الفرع (من شاشة القائمة، وليس حتى من شاشة التفاصيل نفسها التي لا تعرض حتى اسم الفرع!). إن كان للفرع أكثر من مستودع واحد (حالة معتادة حسب بنية `warehouses` بالتقرير السابق)، لا توجد أي وسيلة من هذه الشاشة لتحديد المستودع الدقيق دون فتح فاتورة الإخراج المرتبطة يدوياً (إن وُجدت وكانت مرحّلة).

## 9. سطر المادة يسمح بتغيير المستودع بعيداً عن مستودع المناقلة المُعلن، دون أي قفل أو تحذير

عند إنشاء فاتورة الإخراج/الإدخال من مناقلة، القيمة الافتراضية لكل سطر هي مستودع المناقلة (`invoice-form.tsx:703-706, 736`، ممرَّرة كـ`defaultWarehouseId` إلى `InvoiceMaterialLinesTable`). لكن الحقل نفسه بجدول الأسطر **قابل للتعديل بحرّية كاملة**:

`web/src/modules/invoices/components/invoice-material-lines-table.tsx:708-724`:
```tsx
<select
  disabled={readOnly}       // readOnly=false دائماً بمسار إنشاء مناقلة
  value={line.warehouse_id}
  onChange={(e) => updateLine(line.clientId, { warehouse_id: e.target.value })}
>
  {whOptions.map((wh) => ( <option key={wh.id} value={wh.id}>{wh.warehouse_code} — {wh.name_ar}</option> ))}
</select>
```
لا `readOnly`/تعطيل خاص بسياق `commercialKind === "transfer_out" | "transfer_in"`، ولا أي تحذير عند اختيار مستودع مغاير عن `defaultWarehouseId`. يمكن عملياً لمستخدم أن ينشئ مناقلة "من مستودع A إلى مستودع B" ثم يُبدّل مستودع سطر معيّن إلى مستودع C عند تعبئة فاتورة الإخراج فعلياً — فتُرحَّل حركة `inventory_movements` بمستودع C، بينما مستند المناقلة (وشاشة تفاصيله، ولوحة "العالقة") لا تزال تشير جميعها إلى المستودعين A/B الأصليين. لا مطابقة رجعية تربط هذا الانحراف بأي مكان.

## 10. حالة المناقلة تُعرض بالإنجليزية الخام في شاشة التفاصيل

`web/src/app/invoices/transfers/[id]/page.tsx:77`:
```tsx
<p className="text-xs text-slate-600">الحالة: {transfer.status}</p>
```
بينما شاشتا القائمة والتنبيه تترجمان الحالة بشكل صحيح عبر خرائط تسمية مخصصة (`STATUS_LABELS` بـ`transfers-list-table.tsx:6-13`, `STATUS_LABEL` بـ`stuck-transfers-alert.tsx:25-29`)، شاشة التفاصيل تطبع القيمة الخام مباشرة من عمود `status` بقاعدة البيانات. النتيجة: كل زيارة لأي مناقلة غير مسودة تعرض نصاً مثل **"الحالة: dispatched"** أو **"الحالة: partially_received"** وسط شاشة عربية بالكامل — أبسط أشكال أخطاء الترجمة وأكثرها ظهوراً (يحدث في كل مرة، وليس بحالة حافة).

## 11. عدم اتساق نظام التصميم بين شاشات المناقلة الثلاث

شاشة القائمة (`transfers/page.tsx:72`) وجدول القائمة (`transfers-list-table.tsx:57,64,72`) يستخدمان بشكل صحيح الأصناف المشتركة `btn btn-primary` / `btn btn-sm btn-outline` ومتغيرات CSS (`text-[var(--success)]`)، المُعرَّفة فعلياً بـ`web/src/app/globals.css:22-23` (`--success`, `--danger`) و`:149,168` (`.btn-primary`, `.btn-outline`).

لكن شاشتي **الإنشاء** والـ**تفاصيل** تخرجان عن هذا النمط بالكامل وتستخدمان ألوان Tailwind خام غير مرتبطة بنظام التصميم:
- `web/src/app/invoices/transfers/new/page.tsx:236` — `className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"` (بدل `btn btn-primary`).
- نفس الملف، سطر 244 — `className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"` (بدل `btn btn-outline`).
- `web/src/app/invoices/transfers/[id]/page.tsx:83,91,99,107` — أربعة أزرار بألوان Tailwind حرفية مختلفة (`bg-amber-600`, `border-amber-300 text-amber-800`, `bg-emerald-700`, `border-emerald-300 text-emerald-800`) بدلاً من `btn`/`btn-outline` و`var(--success)`/`var(--danger)` أو حتى نفس تدرّج الكهرماني/الأخضر المُستخدم بجدول القائمة لنفس الأزرار تحديداً (`text-amber-800` / `text-[var(--success)]` بـ`transfers-list-table.tsx:64,72` — أي حتى اللون المفهومي "نفسه" مُطبَّق بطريقتين مختلفتين بين شاشتين للميزة ذاتها).

لا استخدام لمكوّن `Modal` المشترك (`web/src/components/modal.tsx`) بأي من الشاشات الثلاث — وهو منطقي فقط لأنه لا يوجد أي إجراء هدّام (حذف/إلغاء) بهذه الشاشات أصلاً (انظر §12)، وليس بحد ذاته خللاً.

## 12. لا مسار لإلغاء أو حذف مستند مناقلة — حتى وهو مسودة فارغة تماماً

`status` بجدول `inventory_transfers` يقبل القيمة `'cancelled'` (`database/setup_all.sql:4076-4078`) وتُترجَم فعلاً بالواجهة ("ملغاة"، `transfers-list-table.tsx:12`)، لكن **لا يوجد أي مسار برمجي يصل إليها**: لا دالة `cancelTransfer`/`deleteTransfer` بـ`transfer-api.ts`، ولا أي زر حذف/إلغاء بأي من الشاشات الثلاث (تحقق شامل: بحث عن `delete`/`cancel` بمجلد `transfers` لا يُظهر إلا الكلمة الإنجليزية `cancelled` كجزء من متغير `cancelled` الخاص بتتبّع إلغاء طلبات `fetch` عند تفكيك المكوّن — لا علاقة له بحالة المستند). هذا يعني أن مناقلة أُنشئت بالخطأ (مادة خاطئة، أو حتى بمزيج فرع/مستودع متضارب كما بـ§5) **تبقى للأبد** بقائمة المناقلات النشطة بلا أي وسيلة لإخفائها أو التخلص منها من الواجهة، حتى لو كانت لا تزال `draft` بلا أي فاتورة مرتبطة بها إطلاقاً (أي بلا أي أثر مخزوني أو محاسبي يستدعي حذراً في الحذف).

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **أضف فحص `!transfer.in_invoice_id` (أو ما هو أدق: أن الحالة ليست `received`) لزر/رابط "إدخال" بكل من `transfers-list-table.tsx:69` و`[id]/page.tsx:96`** — بنفس نمط الفحص الموجود فعلاً لجهة "الإخراج". هذا أخطر خلل بهذا التدقيق: مناقلة مكتملة الاستلام تعرض دائماً دعوة نشطة لإنشاء فاتورة إدخال إضافية، وترحيلها يُضاعف حركة المخزون والقيد المحاسبي فعلياً بلا أي تحذير.

2. **أضف قيداً فريداً جزئياً على `invoices (inventory_transfer_id, transfer_role) where status <> 'cancelled'`** (أو تحقق مكافئ بتريغر) يمنع وجود أكثر من فاتورة إخراج/إدخال واحدة فعّالة لكل طرف من كل مناقلة — يحل جذرياً كلاً من §2 و§3 على مستوى قاعدة البيانات، وليس فقط بإخفاء زر بالواجهة (الذي يبقى قابلاً للتجاوز عبر التنقل المباشر للرابط `/invoices/new?transfer=...&role=in`).

3. **اربط `inventory_transfer_lines.qty_shipped`/`qty_received`/`unit_cost_at_ship` فعلياً** — أضف تحديثاً داخل فرعي `transfer_out`/`transfer_in` بـ`post_invoice()` (`database/setup_all.sql:19498-19669`) يكتب هذه القيم من `invoice_material_lines` المقابلة عند كل ترحيل (باستخدام `out_line_id`/`in_line_id` الموجودَين بالفعل بالمخطط لكن غير مُستخدَمين — اربطهما عند إنشاء سطر الفاتورة). بدون هذا، شاشة تفاصيل المناقلة ستستمر بعرض "٠" دائماً بعمودي المشحون/المستلم، ومنطق `partially_received` التلقائي سيبقى كوداً ميتاً، وتعبئة فاتورة الإدخال ستستمر بتجاهل الكمية المشحونة الفعلية (§4).

### 🟠 عالٍ

4. **أضف تريغر أو قيد `CHECK` (عبر دالة) يتحقق أن `from_warehouse_id.branch_id = from_branch_id` و`to_warehouse_id.branch_id = to_branch_id`** عند إدراج/تعديل `inventory_transfers` — يمنع إنشاء مناقلات بمزيج متضارب من الأساس، بدل اكتشافها لاحقاً برسالة SQL خام غير مترجمة عند محاولة إصدار الفاتورة (§5). بالتوازي، أضف بواجهة `new/page.tsx` تصفيراً لـ`fromWarehouseId`/`toWarehouseId` (`useEffect` بسيط) عند تغيّر `fromBranchId`/`toBranchId` لمنع الحالة المتضاربة بصرياً أيضاً.

5. **اجعل حقل مستودع السطر للقراءة فقط (`readOnly`) عند `commercialKind === "transfer_out" | "transfer_in"`** بـ`invoice-material-lines-table.tsx:708-724`، أو أضف تحذيراً صريحاً عند الانحراف عن `defaultWarehouseId` — لمنع كسر اتساق مستند المناقلة مع الحركة الفعلية المرحّلة (§9).

6. **صحّح مُرساة القياس بتنبيه المناقلات العالقة إلى `shipped_at` بدل `created_at`** — أضف `shipped_at` لاستعلام `transferApi.listTransfers()` (`transfer-api.ts:66-73`) ونوع `InventoryTransferListItem` (`types.ts:274-283`)، وعدّل `isStuck()` بـ`stuck-transfers-alert.tsx:18-23` لاستخدامه (مع بديل `created_at` فقط لمناقلات لم تُشحن بعد إن رغبتَ بتنبيه مختلف لحالة "مسودة عالقة"). التوصية الأصلية بالتقرير الأوسع نُفِّذت شكلياً لكنها تقيس اللحظة الخطأ حالياً.

### 🟡 متوسط

7. **استبدل توليد `transfer_no` بـ`count()+1` بتسلسل قاعدة بيانات (`sequence`) حقيقي، مُصفَّى بالسنة إن أردت الحفاظ على شكل `TR-YYYY-NNNN` كتسلسل سنوي فعلي** — يحل السباق (`transfer-api.ts:50-59`) ويُزيل التناقض بين الشكل الموحي بترقيم سنوي والمضمون التراكمي الفعلي.

8. **أضف بشاشة تفاصيل المناقلة (`[id]/page.tsx`) عرض اسم الفرع/المستودع للمصدر والوجهة، تاريخي `shipped_at`/`received_at`، والملاحظات (`notes`)** — كل هذه البيانات مُجلَبة فعلاً (`select("*")`) وغير مُستخدَمة بالصفحة، وغيابها يجعل معرفة "أين يجب الاستلام فعلياً" غير ممكنة من هذه الشاشة تحديداً (§8).

9. **استخدم خريطة `STATUS_LABELS` الموجودة فعلاً بـ`transfers-list-table.tsx` لعرض حالة المناقلة بـ`[id]/page.tsx:77`** بدل طباعة قيمة `status` الخام بالإنجليزية — أبسط إصلاح بهذا التقرير وأكثره وضوحاً بصرياً.

10. **وحّد استخدام `.btn`/`.btn-primary`/`.btn-outline` ومتغيرات `var(--success)`/`var(--danger)`** بأزرار `new/page.tsx` (سطر 236, 244) و`[id]/page.tsx` (سطر 83, 91, 99, 107) بدل الألوان الحرفية المتفرقة — نفس الأزرار المفهومية (إخراج/إدخال) تظهر بأنماط مختلفة بين شاشة القائمة وشاشة التفاصيل لنفس التطبيق.

### 🔵 توصية معمارية (تحسين، ليست خطأ حرج)

11. **أضف مساراً فعلياً لإلغاء/حذف مستند مناقلة بحالة `draft` بلا فواتير مرتبطة** (لا خطر مخزوني أو محاسبي بهذه الحالة تحديداً) — يمنع تراكم مناقلات خاطئة لا يمكن التخلص منها (§12)، ويمكن تمديده لاحقاً لحالة `cancelled` الموجودة أصلاً بقيد التحقق دون أي مستهلك برمجي.

## ملحق — ملفات مرجعية رئيسية

- `web/src/app/invoices/transfers/page.tsx` — شاشة القائمة (يُحمِّل `StuckTransfersAlert` + `TransfersListTable`).
- `web/src/app/invoices/transfers/new/page.tsx` — إنشاء مستند المناقلة (بلا ترحيل مخزوني).
- `web/src/app/invoices/transfers/[id]/page.tsx` — تفاصيل المناقلة وروابط فاتورتي الإخراج/الإدخال.
- `web/src/modules/invoices/components/transfers-list-table.tsx` — جدول القائمة، خريطة تسمية الحالات الصحيحة.
- `web/src/modules/invoices/components/stuck-transfers-alert.tsx` — تنبيه المناقلات العالقة (منفَّذ، بخلل قياس زمني).
- `web/src/modules/invoices/services/transfer-api.ts` — كل استدعاءات Supabase الخاصة بالمناقلات (`listTransfers`, `getTransfer`, `createTransfer`, `nextTransferNo`).
- `web/src/modules/invoices/components/invoice-form.tsx:697-758` — تعبئة فاتورة الإخراج/الإدخال تلقائياً من بيانات المناقلة.
- `web/src/modules/invoices/components/invoice-material-lines-table.tsx:708-724` — حقل مستودع السطر القابل للتعديل الحر.
- `database/setup_all.sql:4066-4085` — تعريف `inventory_transfers` (بلا قيد ربط مستودع↔فرع).
- `database/setup_all.sql:4242-4258` — تعريف `inventory_transfer_lines` (الأعمدة الميتة `qty_shipped`/`qty_received`/`unit_cost_at_ship`/`out_line_id`/`in_line_id`).
- `database/setup_all.sql:19103` وما بعده — النسخة الفعّالة (الأخيرة) من `post_invoice()`؛ فرعا `transfer_out` (19498-19560) و`transfer_in` (19562-19669).
- `database/setup_all.sql:4469-4475` — التريغر الذي يكشف لاحقاً (برسالة إنجليزية خام) تضارب مستودع/فرع المناقلة الذي كان يجب رفضه عند الإنشاء.
- `web/src/app/globals.css:22-23,149,168` — تعريف `--success`/`--danger` و`.btn-primary`/`.btn-outline` (نظام التصميم المرجعي).
