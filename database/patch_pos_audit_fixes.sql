-- =============================================================================
-- patch_pos_audit_fixes.sql
-- =============================================================================
-- من تدقيق نقاط البيع (AUDIT_POS.md):
-- 1) صلاحية pos.sell تصبح كافية فعلياً لإنشاء/ترحيل فاتورة POS (بدون الحاجة
--    لمنح invoices.create/edit/post) — مقيّدة بفواتير pos_point_id فقط.
-- 2) تضييق RLS جداول تعريف نقاط البيع لصلاحية pos.settings بدل فتحها لأي
--    مستخدم مسجّل دخول.
-- 3) إنفاذ فعلي (لا واجهة فقط) لأعلام النقطة: allow_price_override،
--    allow_line_discount، require_customer، وقوائم المواد/الفئات المسموحة —
--    داخل assert_invoice_may_post() عند الترحيل.
-- 4) إغلاق سباق تزامن فحص الرصيد المتاح عند الإخراج (بيع/مناقلة/مرتجع شراء)
--    عبر قفل استشاري (advisory lock) لكل زوج (مادة، مستودع) — يمنع بيع نفس
--    الكمية الأخيرة مرتين من نقطتي بيع/مستخدمين متزامنين.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1+3) assert_invoice_may_post — صلاحية pos.sell المقيّدة + إنفاذ أعلام POS
-- ---------------------------------------------------------------------------

create or replace function public.assert_invoice_may_post(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_pat public.invoice_patterns%rowtype;
  v_pos_point public.pos_points%rowtype;
  v_gross numeric(18, 4);
  v_disc numeric(18, 2);
  v_max numeric(5, 2);
  v_applies varchar(10);
  v_line record;
  v_ref_qty numeric(18, 6);
  v_ret_qty numeric(18, 6);
  v_pos_expected_price numeric(18, 4);
begin
  select * into v_inv from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'Invoice not found.';
  end if;

  if not (
    public.has_permission('invoices.post')
    or public.has_permission('invoices.edit')
    or (public.has_permission('pos.sell') and v_inv.pos_point_id is not null)
  ) then
    raise exception
      'Permission denied: invoices.post (or invoices.edit, or pos.sell for a POS invoice) required to post.';
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

  -- ---------------------------------------------------------------------------
  -- إنفاذ إعدادات نقطة البيع (لو الفاتورة صادرة من POS) — AUDIT_POS.md #3
  -- ---------------------------------------------------------------------------
  if v_inv.pos_point_id is not null then
    select * into v_pos_point from public.pos_points where id = v_inv.pos_point_id;

    if found then
      if v_pos_point.require_customer and v_inv.customer_id is null then
        raise exception
          'POS point % requires selecting a customer before posting.',
          v_pos_point.point_code;
      end if;

      for v_line in
        select
          iml.line_no, iml.unit_price, iml.discount_amount, iml.material_id,
          mu.sale_price as unit_sale_price,
          m.sale_price as material_sale_price,
          m.category_id as material_category_id
        from public.invoice_material_lines iml
        inner join public.material_units mu on mu.id = iml.material_unit_id
        inner join public.materials m on m.id = iml.material_id
        where iml.invoice_id = p_invoice_id
      loop
        if not v_pos_point.allow_price_override then
          v_pos_expected_price := coalesce(v_line.unit_sale_price, v_line.material_sale_price, 0);
          if round(v_line.unit_price, 4) <> round(v_pos_expected_price, 4) then
            raise exception
              'POS point % does not allow price override — line % price (%) differs from catalog price (%).',
              v_pos_point.point_code, v_line.line_no, v_line.unit_price, v_pos_expected_price;
          end if;
        end if;

        if not v_pos_point.allow_line_discount and coalesce(v_line.discount_amount, 0) <> 0 then
          raise exception
            'POS point % does not allow line discounts (line %).',
            v_pos_point.point_code, v_line.line_no;
        end if;

        if (
          exists (
            select 1 from public.pos_point_allowed_materials
            where pos_point_id = v_pos_point.id
          )
          or exists (
            select 1 from public.pos_point_allowed_categories
            where pos_point_id = v_pos_point.id
          )
        ) and not (
          exists (
            select 1 from public.pos_point_allowed_materials
            where pos_point_id = v_pos_point.id and material_id = v_line.material_id
          )
          or (
            v_line.material_category_id is not null
            and exists (
              select 1 from public.pos_point_allowed_categories
              where pos_point_id = v_pos_point.id and category_id = v_line.material_category_id
            )
          )
        ) then
          raise exception
            'Material on line % is not allowed for POS point %.',
            v_line.line_no, v_pos_point.point_code;
        end if;
      end loop;
    end if;
  end if;
end;
$$;

comment on function public.assert_invoice_may_post(uuid) is
  'صلاحية الترحيل (+ pos.sell مقيّدة بفاتورة POS) + حد الخصم + سقف المرتجع التراكمي + إنفاذ أعلام نقطة البيع قبل post_invoice.';

grant execute on function public.assert_invoice_may_post(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 1) RLS الفواتير/أسطرها — قبول pos.sell لفاتورة POS فقط (pos_point_id not null)
-- ---------------------------------------------------------------------------

drop policy if exists "invoices_select" on public.invoices;
create policy "invoices_select" on public.invoices
  for select to authenticated
  using (
    public.is_admin()
    or public.has_permission('invoices.view')
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
    or public.has_permission('invoices.post')
    or (public.has_permission('pos.sell') and pos_point_id is not null)
  );

drop policy if exists "invoices_insert" on public.invoices;
create policy "invoices_insert" on public.invoices
  for insert to authenticated
  with check (
    public.is_admin()
    or public.has_permission('invoices.create')
    or (public.has_permission('pos.sell') and pos_point_id is not null)
  );

drop policy if exists "invoice_material_lines_select" on public.invoice_material_lines;
create policy "invoice_material_lines_select" on public.invoice_material_lines
  for select to authenticated
  using (
    public.is_admin()
    or public.has_permission('invoices.view')
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
    or (
      public.has_permission('pos.sell')
      and exists (
        select 1 from public.invoices i
        where i.id = invoice_material_lines.invoice_id
          and i.pos_point_id is not null
      )
    )
  );

drop policy if exists "invoice_material_lines_insert" on public.invoice_material_lines;
create policy "invoice_material_lines_insert" on public.invoice_material_lines
  for insert to authenticated
  with check (
    public.is_admin()
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
    or (
      public.has_permission('pos.sell')
      and exists (
        select 1 from public.invoices i
        where i.id = invoice_material_lines.invoice_id
          and i.pos_point_id is not null
      )
    )
  );

drop policy if exists "invoice_account_lines_select" on public.invoice_account_lines;
create policy "invoice_account_lines_select" on public.invoice_account_lines
  for select to authenticated
  using (
    public.is_admin()
    or public.has_permission('invoices.view')
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
    or (
      public.has_permission('pos.sell')
      and exists (
        select 1 from public.invoices i
        where i.id = invoice_account_lines.invoice_id
          and i.pos_point_id is not null
      )
    )
  );

drop policy if exists "invoice_account_lines_insert" on public.invoice_account_lines;
create policy "invoice_account_lines_insert" on public.invoice_account_lines
  for insert to authenticated
  with check (
    public.is_admin()
    or public.has_permission('invoices.edit')
    or public.has_permission('invoices.create')
    or (
      public.has_permission('pos.sell')
      and exists (
        select 1 from public.invoices i
        where i.id = invoice_account_lines.invoice_id
          and i.pos_point_id is not null
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2) تضييق RLS تعريف نقاط البيع لصلاحية pos.settings — AUDIT_POS.md #2
-- ---------------------------------------------------------------------------

drop policy if exists pos_points_all_authenticated on public.pos_points;
drop policy if exists pos_points_select on public.pos_points;
drop policy if exists pos_points_insert on public.pos_points;
drop policy if exists pos_points_update on public.pos_points;
drop policy if exists pos_points_delete on public.pos_points;

create policy pos_points_select on public.pos_points
  for select to authenticated
  using (
    public.is_admin()
    or public.has_permission('pos.view')
    or public.has_permission('pos.sell')
    or public.has_permission('pos.settings')
  );

create policy pos_points_insert on public.pos_points
  for insert to authenticated
  with check (public.is_admin() or public.has_permission('pos.settings'));

create policy pos_points_update on public.pos_points
  for update to authenticated
  using (public.is_admin() or public.has_permission('pos.settings'))
  with check (public.is_admin() or public.has_permission('pos.settings'));

create policy pos_points_delete on public.pos_points
  for delete to authenticated
  using (public.is_admin() or public.has_permission('pos.settings'));

drop policy if exists pos_payment_all_authenticated on public.pos_point_payment_methods;
drop policy if exists pos_payment_select on public.pos_point_payment_methods;
drop policy if exists pos_payment_insert on public.pos_point_payment_methods;
drop policy if exists pos_payment_update on public.pos_point_payment_methods;
drop policy if exists pos_payment_delete on public.pos_point_payment_methods;

create policy pos_payment_select on public.pos_point_payment_methods
  for select to authenticated
  using (
    public.is_admin()
    or public.has_permission('pos.view')
    or public.has_permission('pos.sell')
    or public.has_permission('pos.settings')
  );

create policy pos_payment_insert on public.pos_point_payment_methods
  for insert to authenticated
  with check (public.is_admin() or public.has_permission('pos.settings'));

create policy pos_payment_update on public.pos_point_payment_methods
  for update to authenticated
  using (public.is_admin() or public.has_permission('pos.settings'))
  with check (public.is_admin() or public.has_permission('pos.settings'));

create policy pos_payment_delete on public.pos_point_payment_methods
  for delete to authenticated
  using (public.is_admin() or public.has_permission('pos.settings'));

drop policy if exists pos_allowed_mat_all_authenticated on public.pos_point_allowed_materials;
drop policy if exists pos_allowed_mat_select on public.pos_point_allowed_materials;
drop policy if exists pos_allowed_mat_insert on public.pos_point_allowed_materials;
drop policy if exists pos_allowed_mat_delete on public.pos_point_allowed_materials;

create policy pos_allowed_mat_select on public.pos_point_allowed_materials
  for select to authenticated
  using (
    public.is_admin()
    or public.has_permission('pos.view')
    or public.has_permission('pos.sell')
    or public.has_permission('pos.settings')
  );

create policy pos_allowed_mat_insert on public.pos_point_allowed_materials
  for insert to authenticated
  with check (public.is_admin() or public.has_permission('pos.settings'));

create policy pos_allowed_mat_delete on public.pos_point_allowed_materials
  for delete to authenticated
  using (public.is_admin() or public.has_permission('pos.settings'));

drop policy if exists pos_allowed_cat_all_authenticated on public.pos_point_allowed_categories;
drop policy if exists pos_allowed_cat_select on public.pos_point_allowed_categories;
drop policy if exists pos_allowed_cat_insert on public.pos_point_allowed_categories;
drop policy if exists pos_allowed_cat_delete on public.pos_point_allowed_categories;

create policy pos_allowed_cat_select on public.pos_point_allowed_categories
  for select to authenticated
  using (
    public.is_admin()
    or public.has_permission('pos.view')
    or public.has_permission('pos.sell')
    or public.has_permission('pos.settings')
  );

create policy pos_allowed_cat_insert on public.pos_point_allowed_categories
  for insert to authenticated
  with check (public.is_admin() or public.has_permission('pos.settings'));

create policy pos_allowed_cat_delete on public.pos_point_allowed_categories
  for delete to authenticated
  using (public.is_admin() or public.has_permission('pos.settings'));

-- ---------------------------------------------------------------------------
-- 4) إغلاق سباق تزامن فحص الرصيد المتاح عند الإخراج — AUDIT_POS.md #4 /
--    AUDIT_INVENTORY.md (قفل استشاري لكل زوج مادة/مستودع طوال المعاملة)
-- ---------------------------------------------------------------------------

create or replace function public.inventory_movements_enforce_stock()
returns trigger
language plpgsql
as $$
declare
  v_balance numeric(18, 6);
  v_enforce boolean := true;
  v_material_code varchar;
  v_warehouse_code varchar;
begin
  if new.quantity_base_delta >= 0 then
    return new;
  end if;

  if new.movement_kind not in ('sale', 'transfer_out', 'return_purchase') then
    return new;
  end if;

  if new.source_type = 'invoice' and new.source_id is not null then
    select coalesce(ip.enforce_stock_availability, true)
    into v_enforce
    from public.invoices i
    inner join public.invoice_patterns ip on ip.id = i.pattern_id
    where i.id = new.source_id;

    if not coalesce(v_enforce, true) then
      return new;
    end if;
  end if;

  -- قفل استشاري بمستوى المعاملة لكل زوج (مادة، مستودع): يمنع قراءتين
  -- متزامنتين لنفس الرصيد قبل أي منهما يُدرِج حركته (سباق بيع آخر وحدة
  -- من نفس المادة من نقطتي بيع/مستخدمين في نفس اللحظة).
  perform pg_advisory_xact_lock(
    hashtextextended(new.material_id::text || '|' || new.warehouse_id::text, 42)
  );

  v_balance := public.get_material_warehouse_qty_balance(
    new.material_id,
    new.warehouse_id,
    new.movement_date
  );

  if v_balance + new.quantity_base_delta < -0.000001 then
    select m.material_code into v_material_code
    from public.materials m where m.id = new.material_id;

    select w.warehouse_code into v_warehouse_code
    from public.warehouses w where w.id = new.warehouse_id;

    raise exception
      'Insufficient stock for material % in warehouse %. Available: %, requested: %.',
      coalesce(v_material_code, new.material_id::text),
      coalesce(v_warehouse_code, new.warehouse_id::text),
      v_balance,
      abs(new.quantity_base_delta);
  end if;

  return new;
end;
$$;
