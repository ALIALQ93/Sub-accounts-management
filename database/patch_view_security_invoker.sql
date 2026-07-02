-- =============================================================================
-- patch_view_security_invoker.sql — إصلاح تحذير Supabase Security Definer View
-- =============================================================================
-- شغّل هذا الملف إذا كان setup_all.sql مُطبَّقاً مسبقاً ولا تريد إعادة التثبيت الكامل.
-- =============================================================================

create or replace view public.account_direct_balances
with (security_invoker = true)
as
select
  jel.account_id,
  coalesce(sum(jel.debit), 0)::numeric(18, 4) as debit,
  coalesce(sum(jel.credit), 0)::numeric(18, 4) as credit,
  coalesce(sum(jel.debit - jel.credit), 0)::numeric(18, 4) as balance
from public.journal_entry_lines jel
inner join public.journal_entries je on je.id = jel.journal_entry_id
where je.status = 'posted'
group by jel.account_id;
