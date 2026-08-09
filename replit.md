# Billzo Office Management System

Agent Management + Attendance module — a premium dark-glass SaaS dashboard for managing agent profiles, documents, and daily attendance.

## Stack

- **Frontend**: React 19 + Vite 8 (SPA)
- **Routing**: TanStack Router v1 (file-based)
- **State/Data**: TanStack Query v5
- **Styling**: Tailwind CSS v4 + tw-animate-css
- **UI components**: Radix UI + shadcn/ui
- **Auth & DB**: Supabase (auth + PostgreSQL + storage)
- **Forms**: React Hook Form + Zod

## Running the app

```bash
npm run dev      # dev server on http://localhost:5000
npm run build    # production build → dist/
npm run preview  # preview production build locally
```

## Deployment (Vercel)

The project is a plain Vite SPA configured for Vercel:

- `vercel.json` rewrites all routes to `index.html` for client-side routing
- Set these environment variables in the Vercel dashboard:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

## Project structure

```
src/
  routes/          # File-based routes (TanStack Router)
    __root.tsx     # Root layout (QueryClient + AuthProvider)
    index.tsx      # Sign-in / Create Account page (/)
    _authenticated/
      route.tsx    # Auth guard — redirects to / if not logged in
      dashboard.tsx
      agents/      # Agent directory, new agent, agent detail
      attendance/  # Clock in/out, daily attendance view
  components/
    agents/        # AgentForm, DocumentManager
    billzo/        # StatCard, StatusBadge, SecureImage, etc.
    layout/        # AppShell (sidebar + nav)
    ui/            # shadcn/ui components
  hooks/
    useAuth.tsx    # Auth context (session, roles, profile)
  integrations/
    supabase/
      client.ts    # Browser Supabase client
      types.ts     # Generated DB types
  lib/             # Utility helpers, query hooks, export utils
```

## Employee ID Format

New format: `B-XXXX` (e.g. `B-3231`, `B-3232`). Run `supabase/migrations/20260804_employee_id_format.sql` in your Supabase SQL Editor to:
1. Update the trigger to generate `B-XXXX` IDs going forward
2. Migrate existing `BZ-EMP-XXXX` records to the new format
3. Advance the sequence so the next new agent gets `B-3231`

To check what the next auto-assigned ID will be:
```sql
SELECT 'B-' || (last_value + 1)::text AS next_employee_id FROM public.agent_emp_seq;
```

## Employee ID Card

Admin and staff: open any agent → **ID Card** tab → preview and print the card. Female agents get a pink-accented card; male agents get a blue-accented card. Opens browser print dialog on a separate page — print on CR80 card stock or laminate.

## Agent Directory — Gender Sort

Agents are automatically sorted: **Female agents first**, then **Male**, then Others. Each gender group has a labelled section divider and a matching accent border on cards (pink for female, blue for male).

## Monthly Sales Loading Fix

The Monthly Sales tab now shows a proper error message and Retry button if the Supabase query fails, instead of getting stuck on "Loading…". If you see this, it usually means the `agent_monthly_sales` migration hasn't been run yet in your Supabase project.

## Salary Management

Admin opens an agent → **Salary** tab → set base salary, add deductions (with remarks) and bonuses per month. Agents see the full breakdown (base / deductions / net pay) in My Profile → Salary tab.

Requires running `supabase/migrations/20260803_salary_ledger.sql` on your Supabase project (SQL Editor) to create the `agent_salary_ledger` table.

## Agent Self Clock-In / Clock-Out

Agents can clock in and out directly from their Dashboard. The Clock In button inserts today's attendance record; Clock Out updates the `clock_out` time and calculates total hours automatically.

## Roles

| Role        | Access                                          |
|-------------|-------------------------------------------------|
| super_admin | Full access — manage admins, agents, all data   |
| admin       | Manage assigned agents, attendance, reports     |
| agent       | Own profile, clock in/out, view salary ledger   |

## User preferences

- Keep the existing dark-glass design system and Tailwind v4 setup.
