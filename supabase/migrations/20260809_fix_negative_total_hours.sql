-- ============================================================================
-- Fix negative / null total_hours on attendance records
-- ----------------------------------------------------------------------------
-- PROBLEM
--   When an admin manually adjusted a night-shift attendance record (e.g.
--   clock-in 21:00, clock-out 06:00 next day), the dialog stored BOTH
--   timestamps on the SAME calendar day. The total_hours calculation then
--   became negative (06:00 - 21:00 = -15h) and was either stored as a
--   negative number or silently dropped to NULL.
--
-- FIX
--   1. Recalculate total_hours for every row that has both clock_in and
--      clock_out. If clock_out < clock_in (midnight-crossing shift), add
--      24 hours so the result is positive.
--   2. Also fix the clock_out timestamp itself for rows where the calculation
--      was negative — push clock_out forward by 24 hours so the stored
--      timestamps are consistent with the (now correct) total_hours.
--
-- This migration is idempotent — safe to run multiple times.
-- ============================================================================

-- Step 1: Recalculate total_hours for all rows with both timestamps.
--         Handles midnight-crossing shifts by adding 24h when negative.
UPDATE public.attendance
SET total_hours = (
  CASE
    WHEN EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600 < 0
    THEN (EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600) + 24
    ELSE EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600
  END
),
updated_at = now()
WHERE clock_in IS NOT NULL
  AND clock_out IS NOT NULL;

-- Step 2: For rows where clock_out was stored on the same day as clock_in
--         but the time-of-day is earlier (indicating a midnight-crossing
--         shift that was incorrectly stored), push clock_out forward by
--         24 hours so the stored timestamp is on the correct calendar day.
--         We only do this when clock_out::time < clock_in::time AND
--         clock_out::date = clock_in::date (i.e. same-day, out-before-in).
UPDATE public.attendance
SET clock_out = clock_out + INTERVAL '1 day',
    updated_at = now()
WHERE clock_in IS NOT NULL
  AND clock_out IS NOT NULL
  AND clock_out::date = clock_in::date
  AND clock_out::time < clock_in::time;

-- Step 3: Recalculate total_hours AGAIN for the rows we just adjusted
--         (so the stored value matches the new clock_out timestamp).
UPDATE public.attendance
SET total_hours = EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600,
    updated_at = now()
WHERE clock_in IS NOT NULL
  AND clock_out IS NOT NULL
  AND total_hours IS NULL;

-- Step 4: Final safety net — any remaining negative total_hours gets
--         absolutified (shouldn't happen after step 1, but just in case).
UPDATE public.attendance
SET total_hours = ABS(total_hours),
    updated_at = now()
WHERE total_hours IS NOT NULL
  AND total_hours < 0;

-- ============================================================================
-- OPTIONAL: Fix clock_in times stored as AM that should be PM (night shifts)
-- ----------------------------------------------------------------------------
-- If you have agents on the "Night (22:00 - 07:00)" shift whose clock_in was
-- accidentally stored as a daytime hour (e.g. 09:00 AM instead of 09:00 PM),
-- this block will add 12 hours to convert AM → PM for those records.
--
-- ⚠️ REVIEW BEFORE RUNNING — this is aggressive. It only triggers for agents
--    whose shift_timing contains 'Night' AND whose clock_in hour is between
--    06:00 and 18:00 (looks like a daytime hour for a night-shift worker).
-- ============================================================================

-- First, REVIEW which rows would be affected:
--   SELECT a.id, a.date, a.clock_in, a.clock_out, a.total_hours,
--          ag.full_name, ag.shift_timing
--   FROM public.attendance a
--   JOIN public.agents ag ON ag.id = a.agent_id
--   WHERE ag.shift_timing ILIKE '%night%'
--     AND a.clock_in IS NOT NULL
--     AND EXTRACT(HOUR FROM a.clock_in) >= 6
--     AND EXTRACT(HOUR FROM a.clock_in) < 18;

-- Then, IF you're happy with the preview, run the fix:
UPDATE public.attendance
SET clock_in = clock_in + INTERVAL '12 hours',
    updated_at = now()
WHERE agent_id IN (
    SELECT id FROM public.agents
    WHERE shift_timing ILIKE '%night%'
)
AND clock_in IS NOT NULL
AND EXTRACT(HOUR FROM clock_in) >= 6
AND EXTRACT(HOUR FROM clock_in) < 18;

-- After the clock_in fix, recalculate total_hours for those rows too:
UPDATE public.attendance
SET total_hours = (
  CASE
    WHEN EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600 < 0
    THEN (EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600) + 24
    ELSE EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600
  END
),
updated_at = now()
WHERE clock_in IS NOT NULL
  AND clock_out IS NOT NULL;

-- Done. Verify with:
--   SELECT id, clock_in, clock_out, total_hours
--   FROM public.attendance
--   WHERE clock_in IS NOT NULL AND clock_out IS NOT NULL
--   ORDER BY date DESC
--   LIMIT 20;

