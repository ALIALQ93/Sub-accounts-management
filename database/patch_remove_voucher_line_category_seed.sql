-- patch_remove_voucher_line_category_seed.sql
-- إزالة تصنيفات أسطر السند الافتراضية (اطعام، تغذية، انشائية)
-- Run in Supabase SQL Editor on existing databases that were seeded with defaults.
-- Safe: يحذف فقط التصنيفات غير المستخدمة في voucher_lines.

delete from public.voucher_line_categories vlc
where vlc.voucher_type = 'payment'
  and vlc.code in ('PAY-FOOD', 'PAY-NUTR', 'PAY-CONST')
  and not exists (
    select 1
    from public.voucher_lines vl
    where vl.line_category_id = vlc.id
  );
