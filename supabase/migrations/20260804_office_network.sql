-- ── Office Network Settings ──────────────────────────────────────────────────
-- Stores allowed public IPs for agent clock-in enforcement.

create table if not exists office_network_settings (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,          -- e.g. "HMR 5G", "HMR"
  allowed_ip  text not null,          -- public IPv4 of the office router
  enabled     boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Attendance Violations ─────────────────────────────────────────────────────
-- Logs every clock-in attempt that was blocked due to wrong network.

create table if not exists attendance_violations (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid references agents(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  ip_address   text,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table office_network_settings enable row level security;
alter table attendance_violations   enable row level security;

-- Network settings: staff can read, staff can write
create policy "staff read network settings"
  on office_network_settings for select
  using (public.is_staff(auth.uid()));

create policy "staff write network settings"
  on office_network_settings for all
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- Violations: staff can read all; agents can insert their own
create policy "staff read violations"
  on attendance_violations for select
  using (public.is_staff(auth.uid()));

create policy "agent insert own violation"
  on attendance_violations for insert
  with check (
    agent_id in (
      select id from agents where user_id = auth.uid()
    )
  );
