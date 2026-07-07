-- =============================================================================
-- patch_voucher_lines_delete_rls.sql — إصلاح تكرار أسطر السند عند الحفظ
-- =============================================================================
-- السبب: RLS كان يمنع DELETE على voucher_lines و voucher_allocations بصمت،
-- فيُضاف أسطر جديدة دون حذف القديمة مع كل حفظ.
-- =============================================================================

drop policy if exists "voucher_lines_delete_all" on public.voucher_lines;
create policy "voucher_lines_delete_all" on public.voucher_lines
  for delete to authenticated using (true);

drop policy if exists "voucher_allocations_delete_all" on public.voucher_allocations;
create policy "voucher_allocations_delete_all" on public.voucher_allocations
  for delete to authenticated using (true);
