-- ============================================================================
-- Attendance Requests
-- ----------------------------------------------------------------------------
-- Agents submit requests (leave, sick, missing check-in, adjustments, etc.)
-- Super Admins/Admins approve or reject them.
-- When an adjustment is approved, the attendance record is updated + audited.
-- ============================================================================

-- ── 1. Table ─────────────────────────────────────────────────────────────────
create table if not exists public.attendance_requests (
  id              uuid primary key default gen_random_uuid(),

  -- Who submitted
  agent_id        uuid not null references public.agents(id) on delete cascade,

  -- Request type (free text but constrained to known values via CHECK)
  request_type    text not null check (request_type in (
    'leave','sick_leave','fever_illness','emergency_leave',
    'late_arrival','early_departure',
    'missing_check_in','missing_check_out',
    'attendance_adjustment','wrong_attendance',
    'day_off','other'
  )),

  -- Dates: single-date requests use attendance_date; multi-day leave uses from_date/to_date
  attendance_date date,
  from_date       date,
  to_date         date,

  -- Required reason + optional details
  reason          text not null,
  details         text,

  -- Optional attachment (file path in Supabase Storage)
  attachment_url  text,

  -- For adjustment-type requests: what the agent wants the attendance to be
  requested_clock_in   timestamptz,
  requested_clock_out  timestamptz,
  requested_status     text check (requested_status in ('present','absent','late','half_day','leave','holiday','weekly_off')),

  -- Status lifecycle
  status          text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),

  -- Admin review
  admin_note        text,
  rejection_reason  text,
  reviewed_by       uuid references auth.users(id) on delete set null,
  reviewed_at       timestamptz,

  -- Audit
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Updated_at trigger
drop trigger if exists attendance_requests_updated_at on public.attendance_requests;
create trigger attendance_requests_updated_at
  before update on public.attendance_requests
  for each row execute function public.update_updated_at_column();

-- Grants
grant select, insert, update, delete on public.attendance_requests to authenticated;
grant all on public.attendance_requests to service_role;

-- Indexes
create index if not exists attendance_requests_agent_id_idx on public.attendance_requests(agent_id);
create index if not exists attendance_requests_status_idx on public.attendance_requests(status);
create index if not exists attendance_requests_request_type_idx on public.attendance_requests(request_type);
create index if not exists attendance_requests_attendance_date_idx on public.attendance_requests(attendance_date);
create index if not exists attendance_requests_created_at_idx on public.attendance_requests(created_at desc);

-- ── 2. RLS ───────────────────────────────────────────────────────────────────
alter table public.attendance_requests enable row level security;

-- Agents can read their OWN requests; staff can read ALL
drop policy if exists "att_req read" on public.attendance_requests;
create policy "att_req read" on public.attendance_requests
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid())
  );

-- Agents can INSERT their own requests (status defaults to 'pending')
drop policy if exists "att_req insert" on public.attendance_requests;
create policy "att_req insert" on public.attendance_requests
  for insert to authenticated
  with check (
    exists (select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid())
    and status = 'pending'
  );

-- Agents can UPDATE their own PENDING requests (edit/cancel)
-- Staff can UPDATE any request (approve/reject)
drop policy if exists "att_req update" on public.attendance_requests;
create policy "att_req update" on public.attendance_requests
  for update to authenticated
  using (
    public.is_staff(auth.uid())
    or (
      exists (select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid())
      and status = 'pending'
    )
  )
  with check (
    public.is_staff(auth.uid())
    or (
      exists (select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid())
      -- Agents can only set status to 'pending' or 'cancelled'
      and status in ('pending','cancelled')
    )
  );

-- Only staff can DELETE (and typically we don't delete — we cancel)
drop policy if exists "att_req delete" on public.attendance_requests;
create policy "att_req delete" on public.attendance_requests
  for delete to authenticated
  using (public.is_staff(auth.uid()));

-- ── 3. Audit log table (tracks original → approved attendance changes) ───────
create table if not exists public.attendance_adjustment_audit (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.attendance_requests(id) on delete cascade,
  attendance_id   uuid references public.attendance(id) on delete set null,
  agent_id        uuid not null references public.agents(id) on delete cascade,

  -- Original values (before the adjustment)
  original_clock_in   timestamptz,
  original_clock_out  timestamptz,
  original_total_hours numeric(5,2),
  original_status     text,

  -- New values (after the adjustment)
  new_clock_in   timestamptz,
  new_clock_out  timestamptz,
  new_total_hours numeric(5,2),
  new_status     text,

  -- Who approved
  approved_by    uuid references auth.users(id) on delete set null,
  approved_at    timestamptz not null default now()
);

grant select on public.attendance_adjustment_audit to authenticated;
grant all on public.attendance_adjustment_audit to service_role;
alter table public.attendance_adjustment_audit enable row level security;

drop policy if exists "audit read" on public.attendance_adjustment_audit;
create policy "audit read" on public.attendance_adjustment_audit
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid())
  );

-- ── Done ─────────────────────────────────────────────────────────────────────
-- Verification:
--   select * from public.attendance_requests limit 5;
--   select count(*) from public.attendance_requests where status = 'pending';
