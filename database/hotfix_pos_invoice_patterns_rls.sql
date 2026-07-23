-- =============================================================================
-- hotfix_pos_invoice_patterns_rls.sql
-- =============================================================================
-- يسمح لصلاحيات نقاط البيع بقراءة أنماط الفواتير (كان يسبب 406 على .single).
-- شغّل على القاعدة الحالية دون إعادة setup_all.
-- =============================================================================

drop policy if exists "invoice_patterns_select" on public.invoice_patterns;

create policy "invoice_patterns_select" on public.invoice_patterns
  for select to authenticated
  using (
    public.is_admin()
    or public.has_permission('invoices.view')
    or public.has_permission('invoices.settings')
    or public.has_permission('invoices.create')
    or public.has_permission('invoices.edit')
    or public.has_permission('pos.view')
    or public.has_permission('pos.sell')
  );
