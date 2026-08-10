-- ============================================================================
-- agent_monthly_reports
-- ----------------------------------------------------------------------------
-- A single row per agent per month that captures EVERYTHING an agent should be
-- able to review about their own performance: salary breakdown, sales figures,
-- performance score, behavior score, attendance summary and free-form notes.
--
-- Only super_admin / admin can write. Agents can read their own rows.
-- Unique on (agent_id, month) so a report can be upserted safely.
-- ============================================================================

create table if not exists public.agent_monthly_reports (
    id              uuid primary key default gen_random_uuid(),
    agent_id        uuid not null references public.agents(id) on delete cascade,

    -- "YYYY-MM-01" — first day of the reported month (consistent w/ monthly_sales)
    month           date not null,

    -- ── Salary breakdown ───────────────────────────────────────────────────
    base_salary     numeric(12, 2) not null default 0,
    bonus           numeric(12, 2) not null default 0,
    deduction       numeric(12, 2) not null default 0,
    net_salary      numeric(12, 2) generated always as
                        (base_salary + bonus - deduction) stored,

    -- ── Sales figures ───────────────────────────────────────────────────────
    total_sales     numeric(14, 2) not null default 0,
    sales_target    numeric(14, 2) not null default 0,
    -- achievement % is computed client-side to keep the column model simple,
    -- but we also persist it for quick filtering / sorting in admin views.
    achievement_pct numeric(5, 2) generated always as
                        (case when sales_target = 0 then 0
                              else round((total_sales / sales_target) * 100, 2)
                         end) stored,

    -- ── Scores (0..100 — percentage) ────────────────────────────────────────
    performance_score   numeric(5, 2) not null default 0 check (performance_score between 0 and 100),
    behavior_score      numeric(5, 2) not null default 0 check (behavior_score between 0 and 100),
    attendance_score    numeric(5, 2) not null default 0 check (attendance_score between 0 and 100),
    punctuality_score   numeric(5, 2) not null default 0 check (punctuality_score between 0 and 100),

    -- overall 0..100 — weighted average stored so the agent list view can sort
    -- by a single column without re-computing.
    overall_score   numeric(5, 2) generated always as
                        (round(
                            (performance_score * 0.35) +
                            (behavior_score      * 0.20) +
                            (attendance_score    * 0.25) +
                            (punctuality_score   * 0.20),
                        2)) stored,

    -- ── Attendance summary (denormalised snapshot for the month) ────────────
    days_present    integer not null default 0,
    days_absent     integer not null default 0,
    days_late       integer not null default 0,
    days_leave      integer not null default 0,
    total_hours     numeric(7, 2) not null default 0,

    -- ── Free-form ───────────────────────────────────────────────────────────
    -- A short headline shown on the agent's report card (e.g. "Excellent month")
    headline        text,
    -- Detailed notes from the admin / super admin
    notes           text,
    -- One of: praise | improvement | warning | neutral
    sentiment       text not null default 'neutral'
                    check (sentiment in ('praise','improvement','warning','neutral')),

    -- ── Audit ───────────────────────────────────────────────────────────────
    created_by      uuid,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),

    constraint agent_monthly_reports_agent_month_key unique (agent_id, month)
);

-- Helpful indexes
create index if not exists agent_monthly_reports_agent_id_idx
    on public.agent_monthly_reports(agent_id);
create index if not exists agent_monthly_reports_month_idx
    on public.agent_monthly_reports(month desc);
create index if not exists agent_monthly_reports_overall_score_idx
    on public.agent_monthly_reports(overall_score desc);
create index if not exists agent_monthly_reports_created_by_idx
    on public.agent_monthly_reports(created_by);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.agent_monthly_reports enable row level security;

-- Agents can read their OWN reports.
drop policy if exists "agent_monthly_reports_read_own" on public.agent_monthly_reports;
create policy "agent_monthly_reports_read_own"
    on public.agent_monthly_reports for select
    to authenticated
    using (
        -- super_admin / admin can read everything
        exists (
            select 1 from public.user_roles ur
            where ur.user_id = auth.uid()
              and ur.role in ('super_admin','admin')
        )
        OR
        -- or the agent row linked to this user
        exists (
            select 1 from public.agents a
            where a.id = agent_monthly_reports.agent_id
              and a.user_id = auth.uid()
        )
    );

-- Only super_admin / admin can insert / update / delete
drop policy if exists "agent_monthly_reports_write_staff" on public.agent_monthly_reports;
create policy "agent_monthly_reports_write_staff"
    on public.agent_monthly_reports for all
    to authenticated
    using (
        exists (
            select 1 from public.user_roles ur
            where ur.user_id = auth.uid()
              and ur.role in ('super_admin','admin')
        )
    )
    with check (
        exists (
            select 1 from public.user_roles ur
            where ur.user_id = auth.uid()
              and ur.role in ('super_admin','admin')
        )
    );

-- ----------------------------------------------------------------------------
-- updated_at trigger (reuses the standard handle_updated_at if present)
-- ----------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists agent_monthly_reports_updated_at
    on public.agent_monthly_reports;
create trigger agent_monthly_reports_updated_at
    before update on public.agent_monthly_reports
    for each row execute function public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- Helpful comment
-- ----------------------------------------------------------------------------
comment on table public.agent_monthly_reports is
    'Monthly per-agent report card — salary, sales, performance, behavior, attendance summary. Managed by super_admin / admin.';
