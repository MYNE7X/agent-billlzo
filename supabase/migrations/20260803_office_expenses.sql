-- Office Expenses table for Billzo management system
create table if not exists office_expenses (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null default 'general',
  amount        numeric(12,2) not null,
  expense_date  date not null,
  month         text not null, -- 'YYYY-MM-01' for grouping/filtering
  description   text,
  paid_to       text,
  payment_method text default 'cash',
  receipt_url   text,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table office_expenses enable row level security;

-- Only staff (admin / super_admin) can read & write expenses
create policy "staff_select_expenses" on office_expenses
  for select using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid() and role in ('super_admin','admin')
    )
  );

create policy "staff_insert_expenses" on office_expenses
  for insert with check (
    exists (
      select 1 from user_roles
      where user_id = auth.uid() and role in ('super_admin','admin')
    )
  );

create policy "staff_update_expenses" on office_expenses
  for update using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid() and role in ('super_admin','admin')
    )
  );

create policy "staff_delete_expenses" on office_expenses
  for delete using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid() and role in ('super_admin','admin')
    )
  );

-- Grant table-level privileges to the authenticated role so the Supabase
-- client (anon/service-role JWT) can reach the table; RLS policies above
-- then enforce per-row authorization.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table office_expenses to authenticated;
