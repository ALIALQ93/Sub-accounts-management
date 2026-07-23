-- =============================================================================
-- patch_invoices_audit_fix.sql (#46)
-- =============================================================================
-- من تدقيق 2026-07-23 (فواتير):
-- 1) إنفاذ max_discount_percent في التريغر + عند الترحيل
-- 2) سقف مرتجع تراكمي (SQL) + فحص عند الترحيل
-- 3) صلاحية داخل post_invoice (invoices.post أو invoices.edit)
-- 4) cancel_draft_invoice + تحرير الحجز عند release_on_cancel
-- 5) منع تعديل رأس فاتورة مرحّلة (ما عدا reference_closed_at)
-- 6) RLS كتابة الفواتير/الأنماط عبر has_permission
-- =============================================================================

create or replace function public.is_invoice_cancelling()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.invoice_cancelling', true), '') = 'true';
$$;

create or replace function public.assert_invoice_may_post(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_pat public.invoice_patterns%rowtype;
  v_gross numeric(18, 4);
  v_disc numeric(18, 2);
  v_max numeric(5, 2);
  v_applies varchar(10);
  v_line record;
  v_ref_qty numeric(18, 6);
  v_ret_qty numeric(18, 6);
begin
  if not (
    public.has_permission('invoices.post')
    or public.has_permission('invoices.edit')
  ) then
    raise exception 'Permission denied: invoices.post (or invoices.edit) required to post.';
  end if;

  select * into v_inv from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'Invoice not found.';
  end if;

  select * into v_pat from public.invoice_patterns where id = v_inv.pattern_id;

  v_max := v_pat.max_discount_percent;
  v_applies := coalesce(v_pat.discount_applies_to, 'line');

  if v_pat.discount_enabled and v_max is not null then
    if v_applies <> 'invoice' then
      for v_line in
        select *
        from public.invoice_material_lines
        where invoice_id = p_invoice_id
      loop
        v_gross := v_line.quantity * v_line.unit_price;
        if coalesce(v_line.discount_percent, 0) > v_max then
          raise exception
            'Line % discount percent (%) exceeds pattern max (%).',
            v_line.line_no, v_line.discount_percent, v_max;
        end if;
        v_disc := coalesce(v_line.discount_amount, 0);
        if v_disc > 0 and v_gross > 0
           and (v_disc / v_gross * 100) > (v_max + 0.01) then
          raise exception
            'Line % discount amount exceeds pattern max percent (%).',
            v_line.line_no, v_max;
        end if;
      end loop;
    end if;

    if v_applies <> 'line' then
      if coalesce(v_inv.invoice_discount_percent, 0) > v_max then
        raise exception
          'Invoice discount percent (%) exceeds pattern max (%).',
          v_inv.invoice_discount_percent, v_max;
      end if;
      if coalesce(v_inv.invoice_discount_amount, 0) > 0
         and coalesce(v_inv.invoice_discount_percent, 0) = 0 then
        select coalesce(sum(iml.line_amount), 0) into v_gross
        from public.invoice_material_lines iml
        where iml.invoice_id = p_invoice_id;
        -- مقارنة تقريبية: أعد بناء الإجمالي قبل خصم الفاتورة ≈ sum line_amount
        -- (خصم الفاتورة يُحسب من مجموع الأسطر الصافية)
        if v_gross > 0
           and (v_inv.invoice_discount_amount / v_gross * 100) > (v_max + 0.01) then
          raise exception
            'Invoice discount amount exceeds pattern max percent (%).',
            v_max;
        end if;
      end if;
    end if;
  end if;

  -- سقف مرتجع تراكمي لفواتير المرتجع
  if v_pat.commercial_kind in ('return_sale', 'return_purchase') then
    for v_line in
      select *
      from public.invoice_material_lines
      where invoice_id = p_invoice_id
    loop
      select coalesce(sum(src.quantity), 0)
      into v_ref_qty
      from public.invoice_material_lines src
      where src.material_id = v_line.material_id
        and src.material_unit_id = v_line.material_unit_id
        and src.invoice_id in (
          select v_inv.reference_invoice_id
          where v_inv.reference_invoice_id is not null
          union
          select irl.reference_invoice_id
          from public.invoice_reference_links irl
          where irl.invoice_id = p_invoice_id
        );

      select coalesce(sum(ret.quantity), 0)
      into v_ret_qty
      from public.invoice_material_lines ret
      inner join public.invoices ri on ri.id = ret.invoice_id
      inner join public.invoice_patterns rp on rp.id = ri.pattern_id
      where ri.status = 'posted'
        and ri.id is distinct from p_invoice_id
        and rp.commercial_kind = v_pat.commercial_kind
        and ret.material_id = v_line.material_id
        and ret.material_unit_id = v_line.material_unit_id
        and (
          ri.reference_invoice_id in (
            select v_inv.reference_invoice_id
            where v_inv.reference_invoice_id is not null
            union
            select irl.reference_invoice_id
            from public.invoice_reference_links irl
            where irl.invoice_id = p_invoice_id
          )
          or exists (
            select 1
            from public.invoice_reference_links link
            where link.invoice_id = ri.id
              and link.reference_invoice_id in (
                select v_inv.reference_invoice_id
                where v_inv.reference_invoice_id is not null
                union
                select irl.reference_invoice_id
                from public.invoice_reference_links irl
                where irl.invoice_id = p_invoice_id
              )
          )
        );

      if v_line.quantity > (v_ref_qty - v_ret_qty) + 0.000001 then
        raise exception
          'Return qty for line % exceeds remaining reference qty (available %).',
          v_line.line_no, greatest(v_ref_qty - v_ret_qty, 0);
      end if;
    end loop;
  end if;
end;
$$;

comment on function public.assert_invoice_may_post(uuid) is
  'صلاحية الترحيل + حد الخصم + سقف المرتجع التراكمي قبل post_invoice.';

grant execute on function public.assert_invoice_may_post(uuid) to authenticated;

-- كميات مرتجعة مرحّلة per مادة/وحدة لمرجع واحد (للواجهة)
create or replace function public.list_reference_returned_quantities(
  p_reference_invoice_id uuid,
  p_exclude_invoice_id uuid default null
)
returns table (
  material_id uuid,
  material_unit_id uuid,
  quantity numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ret.material_id,
    ret.material_unit_id,
    sum(ret.quantity)::numeric(18, 6) as quantity
  from public.invoice_material_lines ret
  inner join public.invoices ri on ri.id = ret.invoice_id
  inner join public.invoice_patterns rp on rp.id = ri.pattern_id
  where ri.status = 'posted'
    and (p_exclude_invoice_id is null or ri.id <> p_exclude_invoice_id)
    and rp.commercial_kind in ('return_sale', 'return_purchase')
    and (
      ri.reference_invoice_id = p_reference_invoice_id
      or exists (
        select 1
        from public.invoice_reference_links link
        where link.invoice_id = ri.id
          and link.reference_invoice_id = p_reference_invoice_id
      )
    )
  group by ret.material_id, ret.material_unit_id;
$$;

grant execute on function public.list_reference_returned_quantities(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- محفز أسطر المواد — صافي + حد خصم النمط
-- ---------------------------------------------------------------------------

create or replace function public.invoice_material_lines_apply_quantities()
returns trigger
language plpgsql
as $$
declare
  v_gross numeric(18, 4);
  v_discount numeric(18, 2);
  v_extra numeric(18, 2);
  v_max numeric(5, 2);
  v_enabled boolean;
  v_applies varchar(10);
begin
  if not exists (
    select 1 from public.material_units mu
    where mu.id = new.material_unit_id
      and mu.material_id = new.material_id
  ) then
    raise exception 'material_unit_id does not belong to material_id.';
  end if;

  new.quantity_base := public.material_quantity_to_base(new.material_unit_id, new.quantity);
  v_gross := new.quantity * new.unit_price;

  if new.discount_percent is not null and new.discount_percent > 0 then
    v_discount := round((v_gross * new.discount_percent / 100)::numeric, 2);
    new.discount_amount := v_discount;
  else
    v_discount := coalesce(new.discount_amount, 0);
    if v_discount > v_gross then
      raise exception 'discount_amount cannot exceed line gross amount.';
    end if;
  end if;

  if new.extra_percent is not null and new.extra_percent > 0 then
    v_extra := round((v_gross * new.extra_percent / 100)::numeric, 2);
    new.extra_amount := v_extra;
  else
    v_extra := coalesce(new.extra_amount, 0);
  end if;

  new.line_amount := round((v_gross - v_discount + v_extra)::numeric, 2);

  if new.line_amount < 0 then
    raise exception 'Line net amount cannot be negative after discount/extra.';
  end if;

  select
    coalesce(ip.discount_enabled, false),
    ip.max_discount_percent,
    coalesce(ip.discount_applies_to, 'line')
  into v_enabled, v_max, v_applies
  from public.invoices i
  inner join public.invoice_patterns ip on ip.id = i.pattern_id
  where i.id = new.invoice_id;

  if v_enabled and v_max is not null and v_applies <> 'invoice' then
    if coalesce(new.discount_percent, 0) > v_max then
      raise exception 'Line discount percent exceeds pattern max (%).', v_max;
    end if;
    if v_discount > 0 and v_gross > 0
       and (v_discount / v_gross * 100) > (v_max + 0.01) then
      raise exception 'Line discount amount exceeds pattern max percent (%).', v_max;
    end if;
  end if;

  if exists (
    select 1 from public.warehouses w
    where w.id = new.warehouse_id
      and w.branch_id <> new.branch_id
  ) then
    raise exception 'warehouse branch must match line branch_id.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- حقن فحص ما قبل الترحيل داخل post_invoice (يُستدعى من النسخة المحدَّثة أدناه عبر
-- تعديل patch_invoice_pricing_cost — هنا نعيد تعريف غلاف خفيف إن وُجدت الدالة)
-- ---------------------------------------------------------------------------
-- يُحقَن الاستدعاء مباشرة في patch_invoice_pricing_cost.sql؛ هذا الملف يعرّف
-- assert_invoice_may_post فقط. للتطبيق على قاعدة قديمة: أعد تشغيل
-- patch_invoice_pricing_cost.sql بعد هذا الملف، أو setup_all كاملاً.

-- ---------------------------------------------------------------------------
-- إلغاء مسودة
-- ---------------------------------------------------------------------------

create or replace function public.cancel_draft_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_pat public.invoice_patterns%rowtype;
begin
  if not (
    public.has_permission('invoices.cancel')
    or public.has_permission('invoices.edit')
  ) then
    raise exception 'Permission denied: invoices.cancel (or invoices.edit) required.';
  end if;

  perform set_config('app.invoice_cancelling', 'true', true);

  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found.';
  end if;

  if v_inv.status <> 'draft' then
    raise exception 'Only draft invoices can be cancelled with cancel_draft_invoice.';
  end if;

  select * into v_pat from public.invoice_patterns where id = v_inv.pattern_id;

  update public.invoices
  set status = 'cancelled', updated_at = now()
  where id = p_invoice_id;

  if coalesce(v_pat.release_on_cancel, true) then
    perform public.release_invoice_reservations(p_invoice_id, 'released');
  end if;
end;
$$;

comment on function public.cancel_draft_invoice(uuid) is
  'إلغاء فاتورة مسودة + تحرير الحجز عند release_on_cancel.';

grant execute on function public.cancel_draft_invoice(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- رأس فاتورة مرحّلة: لا تعديل إلا reference_closed_at / updated_at
-- ---------------------------------------------------------------------------

create or replace function public.invoices_before_update_guard()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'posted' then
    if (to_jsonb(new) - 'updated_at' - 'reference_closed_at')
       is distinct from (to_jsonb(old) - 'updated_at' - 'reference_closed_at') then
      raise exception
        'Posted invoice cannot be modified. Use a return/correction document.';
    end if;
    return new;
  end if;

  if old.status = 'draft' and new.status = 'cancelled' then
    if not public.is_invoice_cancelling() then
      raise exception 'Use cancel_draft_invoice(invoice_id) to cancel drafts.';
    end if;
    return new;
  end if;

  if old.status = 'cancelled' then
    raise exception 'Cancelled invoice cannot be modified.';
  end if;

  if new.status = 'posted' and old.status <> 'posted' then
    if not public.is_invoice_posting() then
      raise exception 'Use post_invoice(invoice_id) to post invoices.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoices_before_update_guard on public.invoices;
create trigger trg_invoices_before_update_guard
before update on public.invoices
for each row execute function public.invoices_before_update_guard();

-- ---------------------------------------------------------------------------
-- RLS — كتابة الفواتير والأنماط بصلاحيات
-- ---------------------------------------------------------------------------

drop policy if exists "invoices_select_all" on public.invoices;
drop policy if exists "invoices_insert_all" on public.invoices;
drop policy if exists "invoices_update_all" on public.invoices;
drop policy if exists "invoices_all" on public.invoices;

create policy "invoices_select" on public.invoices
  for select to authenticated
  using (
    public.is_admin()
    or public.has_permission('invoices.view')
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
    or public.has_permission('invoices.post')
  );

create policy "invoices_insert" on public.invoices
  for insert to authenticated
  with check (
    public.is_admin()
    or public.has_permission('invoices.create')
  );

create policy "invoices_update" on public.invoices
  for update to authenticated
  using (
    public.is_admin()
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.post')
    or public.has_permission('invoices.cancel')
  )
  with check (
    public.is_admin()
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.post')
    or public.has_permission('invoices.cancel')
  );

drop policy if exists "invoice_material_lines_all" on public.invoice_material_lines;
drop policy if exists "invoice_material_lines_select" on public.invoice_material_lines;
drop policy if exists "invoice_material_lines_write" on public.invoice_material_lines;
create policy "invoice_material_lines_select" on public.invoice_material_lines
  for select to authenticated
  using (
    public.is_admin()
    or public.has_permission('invoices.view')
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
  );
create policy "invoice_material_lines_insert" on public.invoice_material_lines
  for insert to authenticated
  with check (
    public.is_admin()
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
  );
create policy "invoice_material_lines_update" on public.invoice_material_lines
  for update to authenticated
  using (
    public.is_admin()
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
  )
  with check (
    public.is_admin()
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
  );
create policy "invoice_material_lines_delete" on public.invoice_material_lines
  for delete to authenticated
  using (
    public.is_admin()
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
  );

drop policy if exists "invoice_account_lines_all" on public.invoice_account_lines;
drop policy if exists "invoice_account_lines_select" on public.invoice_account_lines;
drop policy if exists "invoice_account_lines_write" on public.invoice_account_lines;
create policy "invoice_account_lines_select" on public.invoice_account_lines
  for select to authenticated
  using (
    public.is_admin()
    or public.has_permission('invoices.view')
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
  );
create policy "invoice_account_lines_insert" on public.invoice_account_lines
  for insert to authenticated
  with check (
    public.is_admin()
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
  );
create policy "invoice_account_lines_update" on public.invoice_account_lines
  for update to authenticated
  using (
    public.is_admin()
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
  )
  with check (
    public.is_admin()
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
  );
create policy "invoice_account_lines_delete" on public.invoice_account_lines
  for delete to authenticated
  using (
    public.is_admin()
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
  );

drop policy if exists "invoice_patterns_select_all" on public.invoice_patterns;
drop policy if exists "invoice_patterns_insert_all" on public.invoice_patterns;
drop policy if exists "invoice_patterns_update_all" on public.invoice_patterns;
drop policy if exists "invoice_patterns_select" on public.invoice_patterns;
drop policy if exists "invoice_patterns_write" on public.invoice_patterns;

create policy "invoice_patterns_select" on public.invoice_patterns
  for select to authenticated
  using (
    public.is_admin()
    or public.has_permission('invoices.view')
    or public.has_permission('invoices.settings')
    or public.has_permission('invoices.create')
    or public.has_permission('invoices.edit')
  );

create policy "invoice_patterns_insert" on public.invoice_patterns
  for insert to authenticated
  with check (
    public.is_admin()
    or public.has_permission('invoices.settings')
  );
create policy "invoice_patterns_update" on public.invoice_patterns
  for update to authenticated
  using (
    public.is_admin()
    or public.has_permission('invoices.settings')
  )
  with check (
    public.is_admin()
    or public.has_permission('invoices.settings')
  );
