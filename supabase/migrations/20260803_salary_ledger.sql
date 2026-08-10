-- ============================================================
-- Agent Salary Ledger
-- Tracks base salary, deductions, and bonuses per month
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_salary_ledger (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id    uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  month       date NOT NULL,                     -- always first day of month, e.g. 2026-08-01
  entry_type  text NOT NULL CHECK (entry_type IN ('base_salary', 'deduction', 'bonus')),
  amount      numeric(14,2) NOT NULL DEFAULT 0,
  remarks     text,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_salary_ledger TO authenticated;
GRANT ALL ON public.agent_salary_ledger TO service_role;

ALTER TABLE public.agent_salary_ledger ENABLE ROW LEVEL SECURITY;

-- Staff can manage all records
CREATE POLICY "Staff can manage salary ledger"
  ON public.agent_salary_ledger
  FOR ALL
  TO authenticated
  USING  (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Agents can view their own salary ledger
CREATE POLICY "Agent can view own salary ledger"
  ON public.agent_salary_ledger
  FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  );
