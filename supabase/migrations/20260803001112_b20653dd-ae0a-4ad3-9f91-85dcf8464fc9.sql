-- ROLES
create type public.app_role as enum ('super_admin','admin','agent');
create type public.agent_status as enum ('active','inactive','suspended','resigned');
create type public.attendance_status as enum ('present','absent','late','half_day','leave','holiday');

create or replace function public.update_updated_at_column()
returns trigger as $$ begin new.updated_at = now(); return new; end; $$
language plpgsql set search_path = public;

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- USER ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('super_admin','admin'))
$$;

create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'super_admin'));
create policy "own profile insert" on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "roles read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));

-- first user becomes super_admin, rest agent
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email)
  on conflict (id) do nothing;
  select count(*) into cnt from public.user_roles;
  insert into public.user_roles (user_id, role)
  values (new.id, case when cnt = 0 then 'super_admin'::public.app_role else 'agent'::public.app_role end)
  on conflict do nothing;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- DEPARTMENTS / DESIGNATIONS
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.departments to authenticated;
grant all on public.departments to service_role;
alter table public.departments enable row level security;
create policy "dept read" on public.departments for select to authenticated using (true);
create policy "dept manage" on public.departments for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));
grant insert, update, delete on public.departments to authenticated;

create table public.designations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  department_id uuid references public.departments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.designations to authenticated;
grant all on public.designations to service_role;
alter table public.designations enable row level security;
create policy "desig read" on public.designations for select to authenticated using (true);
create policy "desig manage" on public.designations for all to authenticated
  using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

insert into public.departments (name) values ('Sales'),('Operations'),('Customer Support'),('Finance'),('IT'),('HR');
insert into public.designations (name) values ('Agent'),('Senior Agent'),('Team Lead'),('Supervisor'),('Manager');

-- AGENTS
create sequence public.agent_emp_seq start 1001;
create sequence public.agent_ref_seq start 1;

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  employee_id text not null unique,
  reference_id text not null unique,
  -- personal
  profile_picture_url text,
  full_name text not null,
  father_name text,
  cnic_number text,
  cnic_front_url text,
  cnic_back_url text,
  passport_number text,
  passport_url text,
  date_of_birth date,
  gender text,
  blood_group text,
  marital_status text,
  -- contact
  phone_number text,
  whatsapp_number text,
  email text,
  emergency_contact_name text,
  emergency_contact_number text,
  home_address text,
  city text,
  province text,
  country text default 'Pakistan',
  -- employment
  department_id uuid references public.departments(id) on delete set null,
  designation_id uuid references public.designations(id) on delete set null,
  joining_date date,
  employee_type text,
  shift_timing text,
  assigned_admin_id uuid references auth.users(id) on delete set null,
  salary numeric(12,2),
  status public.agent_status not null default 'active',
  -- education
  highest_qualification text,
  institute_name text,
  degree text,
  certifications text,
  -- work
  previous_experience text,
  previous_company text,
  skills text,
  languages text,
  notes text,
  -- bank
  bank_name text,
  account_title text,
  account_number text,
  iban text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.agents to authenticated;
grant all on public.agents to service_role;
grant usage on sequence public.agent_emp_seq to authenticated, service_role;
grant usage on sequence public.agent_ref_seq to authenticated, service_role;
alter table public.agents enable row level security;

create or replace function public.set_agent_ids()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.employee_id is null or new.employee_id = '' then
    new.employee_id := 'BZ-EMP-' || nextval('public.agent_emp_seq');
  end if;
  if new.reference_id is null or new.reference_id = '' then
    new.reference_id := 'BZ-REF-' || to_char(now(),'YY') || '-' || lpad(nextval('public.agent_ref_seq')::text, 5, '0');
  end if;
  return new;
end; $$;
create trigger agents_set_ids before insert on public.agents
for each row execute function public.set_agent_ids();
create trigger agents_updated_at before update on public.agents
for each row execute function public.update_updated_at_column();

create policy "agents read" on public.agents for select to authenticated
  using (public.is_staff(auth.uid()) or user_id = auth.uid());
create policy "agents insert" on public.agents for insert to authenticated
  with check (public.is_staff(auth.uid()));
create policy "agents update" on public.agents for update to authenticated
  using (
    public.has_role(auth.uid(),'super_admin')
    or (public.has_role(auth.uid(),'admin') and (assigned_admin_id = auth.uid() or assigned_admin_id is null))
    or user_id = auth.uid()
  );
create policy "agents delete" on public.agents for delete to authenticated
  using (public.has_role(auth.uid(),'super_admin'));

-- DOCUMENTS
create table public.agent_documents (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  category text not null default 'other',
  file_url text not null,
  file_path text,
  file_name text not null,
  file_type text,
  file_size bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.agent_documents to authenticated;
grant all on public.agent_documents to service_role;
alter table public.agent_documents enable row level security;
create trigger agent_documents_updated_at before update on public.agent_documents
for each row execute function public.update_updated_at_column();

create policy "docs read" on public.agent_documents for select to authenticated
  using (public.is_staff(auth.uid()) or exists (select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid()));
create policy "docs insert" on public.agent_documents for insert to authenticated
  with check (public.is_staff(auth.uid()) or exists (select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid()));
create policy "docs update" on public.agent_documents for update to authenticated
  using (public.is_staff(auth.uid()) or exists (select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid()));
create policy "docs delete" on public.agent_documents for delete to authenticated
  using (public.is_staff(auth.uid()) or exists (select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid()));

-- ATTENDANCE
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  date date not null default current_date,
  clock_in timestamptz,
  clock_out timestamptz,
  total_hours numeric(5,2),
  status public.attendance_status not null default 'present',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, date)
);
grant select, insert, update, delete on public.attendance to authenticated;
grant all on public.attendance to service_role;
alter table public.attendance enable row level security;

create or replace function public.calc_working_hours()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.clock_in is not null and new.clock_out is not null then
    new.total_hours := round(extract(epoch from (new.clock_out - new.clock_in))/3600.0, 2);
  end if;
  new.updated_at := now();
  return new;
end; $$;
create trigger attendance_calc before insert or update on public.attendance
for each row execute function public.calc_working_hours();

create policy "att read" on public.attendance for select to authenticated
  using (public.is_staff(auth.uid()) or exists (select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid()));
create policy "att insert" on public.attendance for insert to authenticated
  with check (public.is_staff(auth.uid()) or exists (select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid()));
create policy "att update" on public.attendance for update to authenticated
  using (public.is_staff(auth.uid()) or exists (select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid()));
create policy "att delete" on public.attendance for delete to authenticated
  using (public.has_role(auth.uid(),'super_admin'));

-- ACTIVITY LOGS
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.activity_logs to authenticated;
grant all on public.activity_logs to service_role;
alter table public.activity_logs enable row level security;
create policy "logs read" on public.activity_logs for select to authenticated
  using (public.is_staff(auth.uid()));
create policy "logs insert" on public.activity_logs for insert to authenticated
  with check (actor_id = auth.uid());

create index on public.agents (status);
create index on public.agents (assigned_admin_id);
create index on public.attendance (date);
create index on public.attendance (agent_id);
create index on public.agent_documents (agent_id);