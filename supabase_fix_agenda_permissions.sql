
-- ==============================================================================
-- AGENDA FIX: Allow Local Users (Non-UUID) & Anon Access
-- ==============================================================================

-- 1. Drop Foreign Key Constraints (They enforce UUIDs from auth.users)
ALTER TABLE public.agenda_tasks DROP CONSTRAINT IF EXISTS agenda_tasks_assigned_to_fkey;
ALTER TABLE public.agenda_tasks DROP CONSTRAINT IF EXISTS agenda_tasks_assigned_by_fkey;
ALTER TABLE public.agenda_tasks DROP CONSTRAINT IF EXISTS agenda_tasks_created_by_fkey;
ALTER TABLE public.agenda_tasks DROP CONSTRAINT IF EXISTS agenda_tasks_completed_by_fkey;

-- 2. Change ID Columns to TEXT to support 'user_admin_001' and other non-UUIDs
-- We use a DO block to handle conversions safely
DO $$
BEGIN
    -- Assigned To
    BEGIN
        ALTER TABLE public.agenda_tasks ALTER COLUMN assigned_to TYPE text;
    EXCEPTION WHEN OTHERS THEN 
        -- If implicit cast fails, explicit cast (unlikely for uuid->text but good practice)
        ALTER TABLE public.agenda_tasks ALTER COLUMN assigned_to TYPE text USING assigned_to::text;
    END;

    -- Assigned By
    BEGIN
        ALTER TABLE public.agenda_tasks ALTER COLUMN assigned_by TYPE text;
    EXCEPTION WHEN OTHERS THEN 
        ALTER TABLE public.agenda_tasks ALTER COLUMN assigned_by TYPE text USING assigned_by::text;
    END;

    -- Created By
    BEGIN
        ALTER TABLE public.agenda_tasks ALTER COLUMN created_by TYPE text;
    EXCEPTION WHEN OTHERS THEN 
        ALTER TABLE public.agenda_tasks ALTER COLUMN created_by TYPE text USING created_by::text;
    END;

    -- Completed By
    BEGIN
        ALTER TABLE public.agenda_tasks ALTER COLUMN completed_by TYPE text;
    EXCEPTION WHEN OTHERS THEN 
        ALTER TABLE public.agenda_tasks ALTER COLUMN completed_by TYPE text USING completed_by::text;
    END;
END $$;

-- 3. PERMISSIONS & RLS
-- Allow Anonymous (Local Admin) to Insert/Update
ALTER TABLE public.agenda_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert tasks" ON public.agenda_tasks;
DROP POLICY IF EXISTS "Users can view assigned tasks or created tasks" ON public.agenda_tasks;
DROP POLICY IF EXISTS "Users can update assigned tasks" ON public.agenda_tasks;

-- Create a permissive policy for this hybrid app
CREATE POLICY "Allow All Access to Agenda" 
ON public.agenda_tasks 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Explicit Grants
GRANT ALL ON TABLE public.agenda_tasks TO anon, authenticated, service_role;
