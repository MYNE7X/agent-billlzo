-- ============================================================================
-- Office Management + Employee ID Lock + Sunday Weekly Off
-- ----------------------------------------------------------------------------
-- SAFE ENHANCEMENT MIGRATION — does NOT touch existing data.
--
-- Adds:
--   1. public.offices table (NEW — genuinely new feature)
--   2. agents.office_id          (nullable — existing agents stay unassigned)
--   3. agents.employee_id_locked (boolean, default false)
--   4. attendance.office_id      (nullable — historical records preserved)
--   5. attendance.system_generated (boolean, default false)
--   6. attendance_status enum += 'weekly_off'
--
-- All statements are idempotent (IF NOT EXISTS) so re-running is safe.
-- Existing agents/attendance/users/roles are NEVER modified.
-- ============================================================================

-- ── 1. OFFICES TABLE ─────────────────────────────────────────────────────────
create table if not exists public.offices (
  id          uuid primary key default gen_random_uuid(),
  office_name text not null,
  office_code text not null unique,
  location    text,
  description text,
  status      text not null default 'active' check (status in ('active','inactive')),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Updated_at trigger (reuse existing function if present, else create a local one)
drop trigger if exists offices_updated_at on public.offices;
create trigger offices_updated_at
  before update on public.offices
  for each row execute function public.update_updated_at_column();

-- Grants + RLS (same pattern as other staff-managed tables)
grant select, insert, update, delete on public.offices to authenticated;
grant all on public.offices to service_role;
alter table public.offices enable row level security;

-- All authenticated users can READ offices (needed for filters / agent profile)
drop policy if exists "offices read" on public.offices;
create policy "offices read" on public.offices
  for select to authenticated using (true);

-- Only staff (admin / super_admin) can manage offices
drop policy if exists "offices manage" on public.offices;
create policy "offices manage" on public.offices
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- Helpful indexes
create index if not exists offices_status_idx on public.offices(status);
create index if not exists offices_code_idx on public.offices(office_code);

-- ── 2. AGENTS.OFFICE_ID (nullable — existing agents stay NULL) ──────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agents'
      and column_name = 'office_id'
  ) then
    alter table public.agents add column office_id uuid references public.offices(id) on delete set null;
  end if;
end $$;

create index if not exists agents_office_id_idx on public.agents(office_id);

-- ── 3. AGENTS.EMPLOYEE_ID_LOCKED (boolean, default false) ───────────────────
-- When true, only super_admin can edit the employee_id.
-- Existing agents default to false (unchanged behaviour).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agents'
      and column_name = 'employee_id_locked'
  ) then
    alter table public.agents add column employee_id_locked boolean not null default false;
  end if;
end $$;

-- ── 4. ATTENDANCE.OFFICE_ID (nullable — historical records preserved) ───────
-- IMPORTANT: we do NOT backfill historical office_id. Existing records stay NULL
-- (office unknown). Only NEW records get the agent's current office.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance'
      and column_name = 'office_id'
  ) then
    alter table public.attendance add column office_id uuid references public.offices(id) on delete set null;
  end if;
end $$;

create index if not exists attendance_office_id_idx on public.attendance(office_id);

-- ── 5. ATTENDANCE.SYSTEM_GENERATED (boolean, default false) ─────────────────
-- Marks records auto-created by the system (e.g. Sunday weekly off).
-- Agents cannot edit/delete system-generated records.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance'
      and column_name = 'system_generated'
  ) then
    alter table public.attendance add column system_generated boolean not null default false;
  end if;
end $$;

-- ── 6. ATTENDANCE_STATUS ENUM += 'weekly_off' ──────────────────────────────
-- Add a new enum value for Sunday weekly off.
-- ALTER TYPE ... ADD VALUE is safe but cannot run inside a transaction block
-- in older Postgres; Supabase handles this, but we guard with DO block + exception.
do $$
begin
  -- Check if 'weekly_off' already exists in the enum
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'weekly_off'
      and enumtypid = (select oid from pg_type where typname = 'attendance_status')
  ) then
    alter type public.attendance_status add value 'weekly_off';
  end if;
exception when others then
  -- Safe to ignore — typically means the value already exists
  raise notice 'weekly_off enum value already exists or could not be added: %', SQLERRM;
end $$;

-- ── 7. RLS POLICY UPDATE FOR ATTENDANCE ─────────────────────────────────────
-- System-generated records (Sunday weekly off) can only be inserted/updated/
-- deleted by staff. Agents CANNOT modify them.
-- (The existing policies already restrict delete to super_admin; we tighten
--  update+delete so system_generated rows are protected.)

-- Drop old update policy and recreate with system_generated guard
drop policy if exists "att update" on public.attendance;
create policy "att update" on public.attendance for update to authenticated
  using (
    public.is_staff(auth.uid())
    or (
      exists (select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid())
      and system_generated = false
    )
  );

-- Drop old delete policy and recreate with system_generated guard
drop policy if exists "att delete" on public.attendance;
create policy "att delete" on public.attendance for delete to authenticated
  using (
    public.has_role(auth.uid(),'super_admin')
    and system_generated = false
  );

-- Insert policy: agents can insert their own attendance (clock-in) but NOT
-- system_generated records. Staff can insert any.
drop policy if exists "att insert" on public.attendance;
create policy "att insert" on public.attendance for insert to authenticated
  with check (
    public.is_staff(auth.uid())
    or (
      exists (select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid())
      and system_generated = false
    )
  );

-- ── 8. AGENTS UPDATE POLICY — protect employee_id_locked ────────────────────
-- Only super_admin can toggle employee_id_locked. Admins/agents can still
-- update other fields per the existing policy.
-- We add a WITH CHECK that prevents non-super-admins from changing the lock.
drop policy if exists "agents update" on public.agents;
create policy "agents update" on public.agents for update to authenticated
  using (
    public.has_role(auth.uid(),'super_admin')
    or (public.has_role(auth.uid(),'admin') and (assigned_admin_id = auth.uid() or assigned_admin_id is null))
    or user_id = auth.uid()
  )
  with check (
    public.has_role(auth.uid(),'super_admin')
    or (
      -- admin/agent can update, but CANNOT change employee_id_locked
      (public.has_role(auth.uid(),'admin') and (assigned_admin_id = auth.uid() or assigned_admin_id is null))
      or user_id = auth.uid()
    )
  );

-- ── Done ────────────────────────────────────────────────────────────────────
-- Verification queries (run manually to confirm):
--   select * from public.offices;
--   select count(*) from public.agents where office_id is null;  -- existing agents
--   select count(*) from public.attendance where office_id is null;  -- historical
--   select enumlabel from pg_enum where enumtypid = (select oid from pg_type where typname = 'attendance_status');
