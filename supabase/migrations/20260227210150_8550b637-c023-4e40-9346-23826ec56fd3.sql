-- No-op migration to trigger Supabase type regeneration
-- This refreshes types.ts to include recently added tables:
-- user_tasks, user_daily_tasks, aop_positions, ios_confirmations, leave_policies, etc.
SELECT 1;