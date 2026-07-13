# تدقيق عميق — أنماط الفواتير (حجز، تخفيض، إغلاق مرجع)

جزء من التدقيق الشامل. أهم اكتشاف هنا يكمّل نمطاً وجدته أصلاً بـ`AUDIT_INVOICES_JOURNAL.md` (خيار FIFO الوهمي) — إعدادات تُعرض للمستخدم كخيارات حقيقية بدون أي تنفيذ فعلي خلفها.

---

## 1) عالي — نمط متكرر: إعدادات أنماط الفواتير مُعرَّفة ومعروضة لكن غير منفَّذة إطلاقاً (3 حالات)

### أ) `invoice_patterns.max_discount_percent` — سقف الخصم غير مُطبَّق

**المكان:** العمود مُعرَّف بـ`patch_invoice_reservation_discount.sql` (سطر 15-17) بقيد صحة `0-100`، لكن **لا يظهر بأي مكان آخر بكامل قاعدة الكود** (بحثت بكل ملفات `database/*.sql`). لا `post_invoice()` ولا محفز `invoice_material_lines_apply_quantities()` (الذي يحسب `discount_amount`/`discount_percent` فعلياً) يتحققان من هذا السقف.

**الأثر:** لو أدخل المحاسب "الحد الأقصى للخصم: 10%" بإعدادات نمط فاتورة معيّن (توقّعاً منه إن النظام سيمنع أي مستخدم من تجاوزه)، أي مستخدم يقدر فعلياً يدخل خصم 90% على أي سطر بدون أي رفض أو تحذير — الإعداد بلا أي أثر حقيقي.

### ب) `invoice_patterns.release_on_cancel` — تحرير الحجز عند الإلغاء غير مربوط بالإعداد

**المكان:** `database/patch_invoice_discount_rounding.sql` — دالة `release_invoice_reservations(p_invoice_id, p_status)` (سطر 186-197).

**المشكلة:** هذي الدالة تُحرّر الحجوزات (`status = p_status`) **بشكل غير مشروط بالكامل** بمجرد استدعائها — لا تتحقق من `invoice_patterns.release_on_cancel` إطلاقاً. يعني القرار الفعلي "هل نحرّر الحجز عند إلغاء الفاتورة" يعتمد 100% على متى/هل تستدعي الواجهة هذي الدالة، مو على الإعداد المُخزَّن بالنمط. لو محاسب ضبط نمطاً بـ`release_on_cancel = false` (يريد إبقاء الحجز حتى بعد الإلغاء لمتابعة يدوية)، قاعدة البيانات ما عندها أي آلية تحترم هذا الاختيار — الدالة تنفّذ التحرير دائماً إذا استُدعيت، بغض النظر عن الإعداد.

### ج) (سبق توثيقه) `company_inventory_settings.costing_method = 'fifo'`

راجع `AUDIT_INVOICES_JOURNAL.md` البند 2 — نفس النمط بالضبط: خيار معروض ومقفول-بعد-الاستخدام لكن غير منفَّذ إطلاقاً بمحرك التكلفة.

**الخلاصة العامة:** هذي ليست حالات معزولة — نمط متكرر 3 مرات يستحق مراجعة شاملة لكل عمود إعداد بجداول `invoice_patterns` و`company_inventory_settings` للتأكد من وجود منطق فعلي يقرأه، قبل الوثوق بأي إعداد آخر مشابه لم يُفحص هنا (مثل `discount_applies_to`, `cost_per_expiry_date`, `cost_per_serial_number` وغيرها — لم أتحقق من هذي تحديداً بهذا التدقيق).

---

## 2) ملاحظة (أولوية منخفضة) — تبعية تسمية مربكة بين ملفين

عمود إعدادات الحجز (`reservation_enabled`, `reserve_on_save`, `release_on_cancel`) عُرِّف بملف `patch_invoice_reservation_discount.sql`، لكن جدول `inventory_reservations` نفسه ودوال تنفيذ الحجز (`sync_invoice_reservations`, `release_invoice_reservations`) عُرِّفت بملف **مختلف تماماً** بالاسم (`patch_invoice_discount_rounding.sql`) رغم إن اسمه يوحي بموضوع "الخصم والتقريب" لا "الحجز". هذا لا يسبب خطأ وظيفي (الترتيب بـ`build_setup_all.ps1` صحيح، `patch_invoice_reservation_discount.sql` يسبق `patch_invoice_discount_rounding.sql`)، لكنه يصعّب على أي مطوّر لاحق (بما فيهم أنا بهذا التدقيق) إيجاد منطق ميزة معيّنة بالملف "المتوقَّع" منطقياً.

---

## 3) ملاحظة إيجابية

`close_invoice_reference()` (`patch_invoice_reference_close.sql`) و`sync_invoice_reservations()` كلاهما يستخدمان `for update`/تحقق حالة صريح قبل التنفيذ — حماية جيدة من التزامن على مستوى الصف الواحد لهذي العمليات تحديداً.
